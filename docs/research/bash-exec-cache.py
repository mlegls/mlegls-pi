"""Join the September 26 token audit to predecessor requests and Connectome traces.
Run after bash-vs-exec-tokens.py. Writes only numeric metadata, not message bodies.
"""
import bisect
import collections as C
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ROOT = Path.home() / '.pi/agent'
OUT = Path('/tmp/bash-exec-tokens')
rs = json.loads((OUT/'requests.json').read_text())
counts = C.Counter()
for r in rs: counts[r['session']] += r['outerCalls']
rs = [r for r in rs if counts[r['session']] >= 5]
lookup = {r['id']:r for r in rs}
sessions = {r['session'] for r in rs}
def stamp(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def lines(p):
    for l in p.read_text(errors='replace').splitlines():
        try: yield json.loads(l)
        except ValueError: pass
compiles = C.defaultdict(list)
memories = C.defaultdict(list)
plans = C.defaultdict(list)
for f in (ROOT/'connectome').glob('**/calls.jsonl'):
    if '_sessions' not in f.parts: continue
    sid=f.parts[f.parts.index('_sessions')+1]
    if sid not in sessions: continue
    model=f.parent.name
    log=f.with_name('lib.log')
    if log.exists():
        for line in log.read_text(errors='replace').splitlines():
            match=re.search(r'^([^ ]+).*\[plan-vs-actual\].*moves=(\d+) solver=([^ ]+)',line)
            if match: plans[(sid,model)].append(dict(ts=stamp(match[1]),moves=int(match[2]),solver=match[3]))
    for e in lines(f):
        if 't' in e: compiles[(sid,model)].append(dict(e,ts=stamp(e['t'])))
    mf=f.with_name('memory-writes.jsonl')
    if mf.exists():
        for e in lines(mf):
            if 't' in e: memories[(sid,model)].append(dict(e,ts=stamp(e['t'])))
for a in compiles.values():a.sort(key=lambda e:e['ts'])
for a in memories.values():a.sort(key=lambda e:e['ts'])
for a in plans.values():a.sort(key=lambda e:e['ts'])
result=[]
seen=set()
for f in sorted(ROOT.glob('sessions/*/*.jsonl'),key=lambda p:p.name):
    es=list(lines(f))
    if not es or es[0].get('id') not in sessions:continue
    sid=es[0]['id']; byid={e.get('id'):e for e in es}; prev=None; sysHash=None; since=[]
    first = next((e['message'].get('content', '') for e in es if e.get('message',{}).get('role')=='user'), '')
    prompt = first if isinstance(first,str) else '\n'.join(b.get('text','') for b in first)
    front = prompt[:250].lower()
    stance = ('verify' if 'verify-story' in front else 'fill' if 'you are `fill`' in front
              else 'implement' if re.search(r'start with .?implement|hacking session', front)
              else 'compile' if 'you are `compile`' in front else 'supervise' if 'supervise' in front
              else 'shape' if re.search(r'shape-specs|start with .?shape',front) else 'other')
    for e in es:
        m=e.get('message',{})
        if m.get('role')=='system':
            sysHash=hashlib.sha256(json.dumps(m,sort_keys=True).encode()).hexdigest()
        if m.get('role')!='assistant':
            since.append((e.get('type'),m.get('role'),e.get('customType')))
            continue
        u=m.get('usage',{})
        ctx=sum(u.get(k,0) for k in ('input','cacheRead','cacheWrite'))
        start=m.get('timestamp',0)/1000
        if not start:start=stamp(e['timestamp'])
        current=dict(id=e['id'],ctx=ctx,model=m.get('model'),provider=m.get('provider'),api=m.get('api'),
                     start=start,end=stamp(e['timestamp']),sysHash=sysHash,output=u.get('output',0),
                     stop=m.get('stopReason'))
        r=lookup.get(e['id'])
        if r and r['session']==sid and e['id'] not in seen:
            seen.add(e['id'])
            r=dict(r,**current,stance=stance)
            r['fresh']=r['input']+r['cacheWrite']
            r['initial']=prev is None
            r['events']=dict(C.Counter(':'.join(str(x) for x in v) for v in since))
            r['compaction']=any(v[0] in ('compaction','branch_summary') for v in since)
            r['systemChanged']=bool(prev and sysHash!=prev['sysHash'])
            r['gap']=start-prev['end'] if prev else None
            r['duration']=current['end']-start
            r['sameModel']=bool(prev and (prev['model'],prev['provider'],prev['api'])==(current['model'],current['provider'],current['api']))
            ancestor=byid.get(e.get('parentId'))
            for _ in range(10000):
                if not ancestor or ancestor.get('message',{}).get('role')=='assistant':break
                ancestor=byid.get(ancestor.get('parentId'))
            r['linear']=bool(prev and ancestor and ancestor.get('id')==prev['id'])
            r['prevCtx']=prev['ctx'] if prev else 0
            r['delta']=ctx-r['prevCtx']
            r['prefixLoss']=max(0,min(ctx,r['prevCtx'])-r['cacheRead']) if prev else 0
            r['growth']=max(0,r['delta']) if prev else ctx
            r['prevStop']=prev['stop'] if prev else None
            a=compiles.get((sid,m.get('model')),[])
            idx=bisect.bisect_right([v['ts'] for v in a],start+0.1)-1
            co=a[idx] if idx>=0 else None
            # The assistant timestamp is stamped after the context hook, before the HTTP request.
            r['connectome']=bool(co and 0 <= start+0.1-co['ts'] < 30)
            if r['connectome']:
                r['compileLag']=start-co['ts']
                for key in ('compiled','piMessages','reused','chars','pending','error','overBudget','maxTokens'):
                    if key in co:r['cn_'+key]=co[key]
                before=a[idx-1] if idx>0 else {}
                r['cn_reuseDeficit']=co.get('piMessages',0)-co.get('reused',0)
                r['cn_changed']=any(co.get(k,0)<before.get(k,0) for k in ('chars','compiled','reused'))
            ps=plans.get((sid,m.get('model')),[])
            pi=bisect.bisect_right([v['ts'] for v in ps],start+0.1)-1
            plan=ps[pi] if pi>=0 else None
            if plan and 0 <= start+0.1-plan['ts'] < 30:
                r['foldMoves']=plan['moves']
                r['solver']=plan['solver']
            result.append(r)
        prev=current;since=[]
(OUT/'cache-requests.json').write_text(json.dumps(result))
mem=[]
for (sid,model),a in memories.items():
    for e in a:
        if '2026-09-20' <= e['t'] < '2026-09-26T04:15:55Z':mem.append(dict(e,session=sid,model=model))
(OUT/'memory-usage.json').write_text(json.dumps(mem))
print('joined requests',len(result),'of',len(rs),'connectome',sum(r['connectome'] for r in result),'memory writes',len(mem))
