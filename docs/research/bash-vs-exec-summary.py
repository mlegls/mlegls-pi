"""Summarize bash-vs-exec-tokens.py output; no transcript bodies required."""
import collections as C
import json
import pathlib
import statistics as S
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/bash-exec-tokens')
rs = json.loads((root / 'requests.json').read_text())
cs = json.loads((root / 'calls.json').read_text())
ls = json.loads((root / 'late.json').read_text())
counts = C.Counter()
for r in rs: counts[r['session']] += r['outerCalls']
rs = [r for r in rs if counts[r['session']] >= 5]
cs = [r for r in cs if counts[r['session']] >= 5]
ls = [r for r in ls if counts[r['session']] >= 5]

def total(a, k): return sum(r.get(k, 0) or 0 for r in a)
def avg(a, k): return total(a, k) / len(a) if a else 0
def ratio(a, num, den): return total(a, num) / total(a, den) if total(a, den) else 0
for r in rs:
    r['context'] = r['input'] + r['cacheRead'] + r['cacheWrite']
    r['fresh'] = r['input'] + r['cacheWrite']
    r['age'] = next((str(n) for n in (20, 50, 100, 200, 500) if r['ordinal'] <= n), '501+')

def describe(a):
    return dict(sessions=len({r['session'] for r in a}), requests=len(a), calls=total(a, 'calls'),
                context=avg(a, 'context'), output=avg(a, 'output'), reasoning=avg(a, 'reasoning'), fresh=avg(a, 'fresh'),
                cachePct=100*ratio(a, 'cacheRead', 'context'), args=ratio(a, 'argTokens', 'calls'),
                result=ratio(a, 'resultTokens', 'results'), callsPerToolTurn=ratio(a, 'calls', 'toolTurn'),
                contextPerCall=ratio(a, 'context', 'calls'), outputPerCall=ratio(a, 'output', 'calls'),
                cost=avg(a, 'cost'), errors=total(a, 'error'), images=total(a, 'images'),
                pullCalls=total(a, 'explicitPull'))

def grouped(a, keys):
    groups = C.defaultdict(list)
    for r in a: groups[tuple(str(r.get(k)) for k in keys)].append(r)
    return {'|'.join(k): describe(v) for k, v in sorted(groups.items())}

def standardized(keys, subset=rs):
    groups = C.defaultdict(lambda: C.defaultdict(list))
    for r in subset: groups[tuple(r[k] for k in keys)][r['mode']].append(r)
    # Common support only: >=30 requests and >=3 sessions on BOTH sides.
    groups = {k:g for k,g in groups.items() if all(len(g[m]) >= 30 and len({r['session'] for r in g[m]}) >= 3 for m in ('exec', 'bash'))}
    weights = {k:min(len(g['exec']), len(g['bash'])) for k,g in groups.items()}
    mass = sum(weights.values())
    out = dict(strata=len(groups), weight=mass, coverage={m:sum(len(g[m]) for g in groups.values()) for m in ('exec', 'bash')})
    for mode in ('exec', 'bash'):
        out[mode] = {metric:sum(weights[k] * describe(g[mode])[metric] for k,g in groups.items())/mass if mass else 0
                     for metric in ('context', 'output', 'reasoning', 'fresh', 'args', 'result', 'callsPerToolTurn', 'contextPerCall', 'outputPerCall', 'cost')}
    return out

summary = dict(overall=grouped(rs, ['mode']), models=grouped(rs, ['model', 'mode']),
               daily=grouped(rs, ['day', 'mode']),
               concept=grouped([r for r in rs if r['project']=='concept'], ['model', 'mode']),
               pi=grouped([r for r in rs if r['project']=='mlegls-pi'], ['model', 'mode']),
               matched=standardized(['project', 'model', 'thinking', 'worktree']),
               ageMatched=standardized(['project', 'model', 'thinking', 'worktree', 'age']),
               ageMatchedModels={model:standardized(['project', 'model', 'thinking', 'worktree', 'age'], [r for r in rs if r['model']==model]) for model in ('claude-opus-5-5', 'gpt-6-luna', 'gpt-6-sol', 'glm-5.3-flash')},
               successfulAgeMatched=standardized(['project', 'model', 'thinking', 'worktree', 'age'], [r for r in rs if not r['error']]),
               concurrentAgeMatched=standardized(['project', 'model', 'thinking', 'worktree', 'age'], [r for r in rs if '2026-09-23' <= r['day'] <= '2026-09-24']),
               calls={}, late={}, sessionMedians={})
for mode in ('exec', 'bash'):
    a = [c for c in cs if c['tool']==mode and c['matched']]
    def quant(v,p): return sorted(v)[min(int(len(v)*p), len(v)-1)]
    summary['calls'][mode] = dict(n=len(a), unmatched=sum(c['tool']==mode and not c['matched'] for c in cs),
        **{k:dict(mean=avg(a,k), median=S.median(c[k] for c in a), p90=quant([c[k] for c in a],.9), p99=quant([c[k] for c in a],.99)) for k in ('argTokens', 'resultTokens')},
        categories={cat:dict(n=len(b), args=avg(b,'argTokens'), result=avg(b,'resultTokens')) for cat in sorted({c['category'] for c in a}) if (b:=[c for c in a if c['category']==cat])})
    b = [r for r in ls if r['mode']==mode]
    summary['late'][mode] = dict(messages=len(b), tokens=total(b,'tokens'), mean=avg(b,'tokens'))
    sg=C.defaultdict(list)
    for r in rs:
        if r['mode']==mode:sg[r['session']].append(r)
    summary['sessionMedians'][mode]={k:S.median(describe(a)[k] for a in sg.values()) for k in ('requests','context','output','args','result','cost')}
(root / 'summary.json').write_text(json.dumps(summary, indent=2))
for section in ('overall','daily','concept','pi','matched','ageMatched','successfulAgeMatched','concurrentAgeMatched','calls','late','sessionMedians'):
    print(section, json.dumps(summary[section], indent=2))
