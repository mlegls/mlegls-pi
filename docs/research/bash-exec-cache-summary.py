"""Summarize cache transitions and memory writes from bash-exec-cache.py."""
import collections as C
import json
import statistics as S
import contextlib
import io
import runpy
from pathlib import Path

p=Path('/tmp/bash-exec-tokens')
rs=json.loads((p/'cache-requests.json').read_text())
mem=json.loads((p/'memory-usage.json').read_text())
MODELS=('claude-opus-5-5','glm-5.3-flash','gpt-6-luna','gpt-6-sol')
def steady(r):
    return (not r['error'] and r['sameModel'] and r['linear'] and r['prevStop'] not in ('error','aborted')
            and 0<=r['gap']<60 and not r['compaction'] and not r['systemChanged'])
def desc(a):
    if not a:return {}
    return dict(n=len(a),sessions=len({r['session'] for r in a}),
                **{k:round(S.mean(r[k] for r in a),2) for k in ('ctx','fresh','prefixLoss','growth','output','reasoning','duration','gap')},
                loss8kPct=round(100*sum(r['prefixLoss']>8192 for r in a)/len(a),2),
                freshSum=sum(r['fresh'] for r in a),lossSum=sum(r['prefixLoss'] for r in a))
s={}
for model in MODELS:
    live=[r for r in rs if r['model']==model]
    a=[r for r in live if steady(r)]
    b=[r for r in a if r['connectome'] and 'foldMoves' in r]
    groups={
        'execSteady':[r for r in a if r['mode']=='exec'],
        'bashUnjoined':[r for r in a if r['mode']=='bash' and not r['connectome']],
        'bashNoFold':[r for r in b if r['foldMoves']==0],
        'bashFold':[r for r in b if r['foldMoves']>0],
        'execFirst20':[r for r in a if r['mode']=='exec' and r['ordinal']<=20 and r['worktree']],
        'bashFirst20':[r for r in a if r['mode']=='bash' and r['ordinal']<=20 and r['worktree']],
    }
    s[model]={k:desc(v) for k,v in groups.items()}
    folds=groups['bashFold'];plain=groups['bashNoFold']
    if b:
        s[model]['foldShare']=dict(requests=len(folds)/len(b),fresh=sum(r['fresh'] for r in folds)/sum(r['fresh'] for r in b),loss=sum(r['prefixLoss'] for r in folds)/sum(r['prefixLoss'] for r in b))
    mm=[m for m in mem if m['model']==model];ids={m['session'] for m in mm}
    s[model]['memory']=dict(n=len(mm),sessions=len(ids),errors=sum(m['stop'] in ('error','aborted') for m in mm),
        **{k:sum(m.get(k,0) or 0 for m in mm) for k in ('input','cacheRead','cacheWrite','output','cost')},
        liveCost=sum(r['cost'] for r in live if r['session'] in ids))
    folded={(r['session'],r['model']) for r in live if r.get('foldMoves',0)>0}
    no_fold=[m for m in mm if (m['session'],model) not in folded]
    s[model]['memoryWithoutObservedFold']=dict(sessions=len({m['session'] for m in no_fold}),
        writes=len(no_fold),cost=sum(m.get('cost',0) or 0 for m in no_fold))
(p/'cache-summary.json').write_text(json.dumps(s,indent=2))
for model,summary in s.items():
    print(model)
    for k,v in summary.items():print(k,json.dumps(v))

# Reuse the first audit's common-support calculation (also refreshes summary.json).
with contextlib.redirect_stdout(io.StringIO()):
    baseline=runpy.run_path(str(Path(__file__).with_name('bash-vs-exec-summary.py')))
for r in rs:
    r['context']=r['ctx']
    r['age']=next((str(n) for n in (20,50,100,200,500) if r['ordinal']<=n),'501+')
keys=['project','model','thinking','worktree','age','stance']
role_matched={model:{label:baseline['standardized'](keys,subset)
    for label,subset in [('all',[r for r in rs if r['model']==model]),
                         ('first20',[r for r in rs if r['model']==model and r['ordinal']<=20])]}
    for model in MODELS}
(p/'cache-role-matched.json').write_text(json.dumps(role_matched,indent=2))
