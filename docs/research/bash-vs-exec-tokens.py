"""Observational token audit. Run: uv run --with tiktoken python THIS_FILE [output-dir].

Reads local Pi transcripts, never writes transcript bodies. o200k_base counts are
text proxies; provider usage is reported separately. Forked entries deduplicate by
(id, timestamp, type). Session mode requires >=90% bash or exec among those calls.
"""
import collections as C
import re
import json
import pathlib
import sys
import tiktoken

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/bash-exec-tokens')
OUT.mkdir(parents=True, exist_ok=True)
ROOT = pathlib.Path.home() / '.pi/agent/sessions'
START = '2026-09-20'
END = '2026-09-26T04:15:55Z'  # Before this audit session; timestamps are UTC.
enc = tiktoken.get_encoding('o200k_base')
def tokens(s): return len(enc.encode(s, disallowed_special=()))
def text(m):
    c = m.get('content', [])
    return c if isinstance(c, str) else '\n'.join(x.get('text', '') for x in c if x.get('type') == 'text')
def calls(m):
    c = m.get('content', [])
    return [x for x in c if x.get('type') == 'toolCall'] if isinstance(c, list) else []
def project(cwd):
    # Surviving .git pointer under this Paseo pool resolves to dev/mmon/concept/.git.
    if '/.paseo/worktrees/0tlsrsf6/' in cwd: return 'concept'
    for p in ('mlegls-pi', 'concept', 'system-config'):
        if p in cwd: return p
    return cwd.split('/dev/')[-1].split('__worktrees')[0]

seen = set()
rows = []
callrows = []
late_rows = []
stats = C.Counter()
# Only actual session files: exclude .ab ledgers. Sort oldest first so originals own inherited entries.
files = sorted(ROOT.glob('*/*.jsonl'), key=lambda p: p.name)
for f in files:
    es = []
    for line in f.read_text(errors='replace').splitlines():
        try: es.append(json.loads(line))
        except ValueError: stats['malformed_lines'] += 1
    if not es or es[0].get('type') != 'session': continue
    cwd = es[0].get('cwd', '')
    if '/tmp/' in cwd or '/private/var/' in cwd: continue
    recent = [e for e in es if START <= e.get('timestamp', '') < END]
    if not recent: continue
    modes = C.Counter(c['name'] for e in recent for c in calls(e.get('message', {})) if c['name'] in ('bash', 'exec'))
    if not modes: continue
    mode, n = modes.most_common(1)[0]
    if n / sum(modes.values()) < .9:
        stats['mixed_sessions'] += 1
        continue
    if mode == 'bash' and not any('AB_SESSION_STATE' in json.dumps(e) or 'ab read' in json.dumps(e) or 'PI_TOOL_MODE' in json.dumps(e) or 'still running' in json.dumps(e) for e in recent):
        stats['unconfirmed_bash_sessions'] += 1
        continue
    stats[mode + '_files'] += 1
    pending = {}
    model = None
    thinking = None
    user = 0
    ordinal = 0
    worktree = any(s in cwd for s in ('/.paseo/worktrees/', '__worktrees/', '/orca/workspaces/'))
    for e in es:
        if e.get('type') == 'model_change': model = e.get('modelId')
        if e.get('type') == 'thinking_level_change': thinking = e.get('thinkingLevel')
        m = e.get('message', {})
        if m.get('role') == 'assistant': ordinal += 1
        if m.get('role') == 'user': user += 1
        ts = e.get('timestamp', '')
        if not START <= ts < END: continue
        key = (e.get('id'), ts, e.get('type'))
        if key in seen:
            stats['duplicate_entries'] += 1
            continue
        seen.add(key)
        base = dict(session=es[0]['id'], project=project(cwd), mode=mode, day=ts[:10], model=m.get('model', model), thinking=thinking, user=user, ordinal=ordinal, worktree=worktree, started=es[0].get('timestamp'))
        if m.get('role') == 'assistant':
            cs = calls(m)
            u = m.get('usage', {})
            r = dict(base, id=e['id'], requests=1, calls=len(cs), outerCalls=sum(c['name'] == mode for c in cs), toolTurn=int(bool(cs)),
                     input=u.get('input', 0), cacheRead=u.get('cacheRead', 0), cacheWrite=u.get('cacheWrite', 0),
                     output=u.get('output', 0), reasoning=u.get('reasoning', 0), cost=u.get('cost', {}).get('total', 0),
                     hasUsage=int(bool(u)), error=int(m.get('stopReason') in ('error', 'aborted')),
                     argTokens=0, resultTokens=0, resultChars=0, results=0, images=0,
                     explicitPull=0, raw=0, resultError=0)
            for c in cs:
                code = c.get('arguments', {}).get('command', c.get('arguments', {}).get('code', ''))
                a = tokens(json.dumps(c.get('arguments', {}), ensure_ascii=False, separators=(',', ':')))
                r['argTokens'] += a
                r['explicitPull'] += int('ab pull ' in code or 'show.pull(' in code)
                r['raw'] += int('ab raw' in code or 'sh.raw' in code or bool(c.get('arguments', {}).get('raw')))
                category = ('edit' if re.search(r'ab edit|\b(edit|write|replace)\s*\(|writeFile|cat\s*>|apply_patch', code)
                            else 'read' if re.search(r'ab read|\bread\s*\(|\b(cat|sed|head|tail)\s', code)
                            else 'search' if re.search(r'ab grep|\bgrep\s*\(|\b(rg|grep|find)\s', code)
                            else 'test' if re.search(r'\b(test|tsc|lint|check)\b', code)
                            else 'git' if re.search(r'\bgit\s', code) else 'other')
                cr = dict(base, tool=c['name'], argTokens=a, resultTokens=0, resultChars=0, matched=0, category=category)
                callrows.append(cr)
                pending[c['id']] = (r, cr)
            rows.append(r)
        elif m.get('role') == 'toolResult' and m.get('toolCallId') in pending:
            r, cr = pending.pop(m['toolCallId'])
            s = text(m)
            t = tokens(s)
            cr.update(resultTokens=t, resultChars=len(s), matched=1, filtered=int(bool(re.search(r'\b(omitted|skim|keyword cues)\b', s))), resultError=int(bool(m.get('isError'))))
            r['resultTokens'] += t
            r['resultChars'] += len(s)
            r['results'] += 1
            r['resultError'] += int(bool(m.get('isError')))
            r['images'] += sum(x.get('type') == 'image' for x in m.get('content', []) if isinstance(x, dict))
        elif e.get('type') == 'custom_message' and e.get('customType') in ('bash-output', 'exec-output'):
            late_rows.append(dict(base, kind=e['customType'], tokens=tokens(text(e))))
            stats[mode + '_custom_' + e['customType']] += 1

(OUT / 'requests.json').write_text(json.dumps(rows))
(OUT / 'calls.json').write_text(json.dumps(callrows))
(OUT / 'late.json').write_text(json.dumps(late_rows))
(OUT / 'meta.json').write_text(json.dumps(dict(stats), indent=2))
print(json.dumps(dict(stats), indent=2))
print('requests', len(rows), 'calls', len(callrows), 'output', OUT)
