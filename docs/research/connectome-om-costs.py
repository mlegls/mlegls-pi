"""Read-only cohort audit; outputs numeric metadata to /tmp/connectome-om-costs.json."""
import json, re, bisect, collections as C
from pathlib import Path
from datetime import datetime
R=Path.home()/'.pi/agent'
def ts(s): return datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def rows(p):
    for l in p.read_text(errors='replace').splitlines():
        try: yield json.loads(l)
        except ValueError: pass
traces={}; memory=[]
for p in (R/'connectome').glob('**/calls.jsonl'):
    if '_sessions' not in p.parts: continue
    sid=p.parts[p.parts.index('_sessions')+1]; model=p.parent.name
    configs=[]; plans=[]
    lp=p.with_name('lib.log')
    if lp.exists():
        for l in lp.read_text(errors='replace').splitlines():
            if 'config:effective' in l:
                try:
                    e=json.loads(l[l.index('{'):])['effective']
                    configs.append((ts(l.split()[0]),e.get('compressionSlackRatio')==.25 and e.get('kvStableReachTokens')==64000))
                except (ValueError,KeyError): pass
            m=re.search(r'moves=(\d+) solver=',l)
            if m: plans.append((ts(l.split()[0]),int(m[1])))
    configs.sort(); plans.sort(); calls=sorted((ts(e['t']),e) for e in rows(p) if 't' in e)
    traces[sid,model]=(calls,configs,plans)
    mp=p.with_name('memory-writes.jsonl')
    if mp.exists():
        for e in rows(mp):
            t=ts(e['t']); i=bisect.bisect_right([x[0] for x in configs],t)-1
            if i>=0 and configs[i][1]: memory.append(dict(e,sid=sid,cohort='trial'))
            elif '2026-09-25'<=e['t']<'2026-09-26T05:00': memory.append(dict(e,sid=sid,cohort='baseline'))
result=[]
for p in R.glob('sessions/*/*.jsonl'):
    if p.name[:10]<'2026-09-15': continue
    es=list(rows(p))
    if not es: continue
    sid=es[0].get('id'); om=any(str(e.get('customType','')).startswith('om.') or e.get('details',{}).get('type')=='om.folded' for e in es if isinstance(e.get('details',{}),dict))
    prev=None; compact=False; ordinal=0
    for e in es:
        if e.get('type') in ('compaction','branch_summary'): compact=True
        m=e.get('message',{}); u=m.get('usage',{})
        if m.get('role')!='assistant' or not u: continue
        t=m.get('timestamp',0)/1000 or ts(e['timestamp']); end=ts(e['timestamp']); model=m.get('model'); ctx=sum(u.get(k,0) for k in ('input','cacheRead','cacheWrite')); ordinal+=1
        cohort=None; fold=None; budget=None
        calls,configs,plans=traces.get((sid,model),([],[],[]))
        i=bisect.bisect_right([x[0] for x in calls],t+.1)-1
        if i>=0 and 0<=t+.1-calls[i][0]<30:
            j=bisect.bisect_right([x[0] for x in configs],t)-1
            if j>=0 and configs[j][1]: cohort='trial'
            elif '2026-09-25'<=e['timestamp']<'2026-09-26T05:00': cohort='baseline'
            budget=calls[i][1].get('maxTokens')
            j=bisect.bisect_right([x[0] for x in plans],t+.1)-1
            if j>=0 and 0<=t+.1-plans[j][0]<30: fold=plans[j][1]>0
        elif om and '2026-09-20'<=e['timestamp']<'2026-09-25': cohort='om'
        good=m.get('stopReason') not in ('error','aborted')
        steady=bool(prev and prev['model']==model and prev['provider']==m.get('provider') and 0<=t-prev['end']<60 and good and prev['good'])
        if cohort and ctx and good:
            result.append(dict(cohort=cohort,sid=sid,model=model,project=es[0].get('cwd'),ordinal=ordinal,context=ctx,fresh=u.get('input',0)+u.get('cacheWrite',0),cache=u.get('cacheRead',0),output=u.get('output',0),cost=u.get('cost',{}).get('total',0),inputCost=sum(u.get('cost',{}).get(k,0) for k in ('input','cacheRead','cacheWrite')),loss=max(0,min(ctx,prev['ctx'])-u.get('cacheRead',0)) if steady else None,steady=steady,compact=compact,fold=fold,budget=budget,time=e['timestamp']))
        prev=dict(model=model,provider=m.get('provider'),ctx=ctx,end=end,good=good); compact=False
out={'requests':result,'memory':memory}
Path('/tmp/connectome-om-costs.json').write_text(json.dumps(out))
for cohort in ('om','baseline','trial'):
    for model in sorted(set(r['model'] for r in result)):
        a=[r for r in result if r['cohort']==cohort and r['model']==model]
        if not a: continue
        n=len(a); s=lambda k:sum(r[k] or 0 for r in a)
        st=[r for r in a if r['steady']]; folds=[r for r in st if r['fold'] or r['compact']]
        mm=[m for m in memory if m['cohort']==cohort and m['sid'] in {r['sid'] for r in a} and m['model'].split('/')[-1]==model]
        memory_cost = None if cohort == 'om' else round(sum(m.get('cost',0) or 0 for m in mm),2)
        print(cohort,model,'n',n,'sessions',len({r['sid'] for r in a}),'ctx',round(s('context')/n),'cache%',round(100*s('cache')/s('context'),2),'fresh',round(s('fresh')/n),'input$/100',round(s('inputCost')/n*100,3),'fg$',round(s('cost'),2),'mem$',memory_cost,'steady',len(st),'loss',round(sum(r['loss'] for r in st)/max(1,len(st))),'folds',len(folds),'foldloss',round(sum(r['loss'] for r in folds)/max(1,len(folds))),'budgets',dict(C.Counter(r['budget'] for r in a)))
