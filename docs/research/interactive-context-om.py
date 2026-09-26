"""Conservative interactive-session comparison around first retained OM usage."""
import json,re,sys,statistics as S,collections as C
from pathlib import Path
ROOT=Path.home()/'.pi/agent/sessions'; seen=set(); rows=[]; sessions=[]; cuts=[]
def text(m):
 c=m.get('content',[])
 return c if isinstance(c,str) else '\n'.join(b.get('text','') for b in c if b.get('type')=='text')
def summary(rs):
 a=sorted(r['tokens'] for r in rs)
 if not a:return {}
 groups=C.defaultdict(list)
 for r in rs:groups[r['root']].append(r['tokens'])
 return dict(n=len(a),roots=len(groups),mean=round(S.mean(a)),median=round(S.median(a)),p90=a[int(.9*(len(a)-1))],over100k=round(sum(v>100000 for v in a)/len(a),3),median_root_median=round(S.median(S.median(v) for v in groups.values())))
for p in sorted(ROOT.glob('*/*.jsonl'),key=lambda p:p.name):
 es=[]
 for l in p.open():
  try:es.append(json.loads(l))
  except ValueError:pass
 if not es or es[0].get('type')!='session':continue
 h=es[0];cwd=h.get('cwd','');us=[e for e in es if e.get('message',{}).get('role')=='user']
 if len(us)<5:continue
 first=text(us[0]['message']).strip()
 if any(s in cwd for s in ('worktrees','/tmp/','/private/var/','/orca/workspaces/')):continue
 if re.match(r'(?i)(<skill|/|start with|you are|current autoread|\[|implement\b|supervise\b)',first):continue
 cased=[text(e['message']).strip() for e in us if '2026-07-01'<=e.get('timestamp','')<'2026-09-25' and re.match(r'[A-Za-z]',text(e['message']).strip())]
 lower_share=sum(s[0].islower() for s in cased)/len(cased) if cased else 0
 majority_lower=len(cased)>=3 and lower_share>0.5
 last_lower=False
 active=False;turn=0;ordinal=0;pending=False;root=us[0]['id'];n=0
 known_om=any(str(e.get('customType','')).startswith('om.') or e.get('details',{}).get('type')=='om.folded' for e in es)
 for e in es:
  t=e.get('timestamp','');m=e.get('message',{});role=m.get('role')
  if str(e.get('customType','')).startswith('om.') or e.get('details',{}).get('type')=='om.folded':active=True
  if role=='user':
   turn+=1;pending=True;last_lower=bool(re.match(r'[a-z]',text(m).strip()))
  if e.get('type')=='compaction' and '2026-07-01'<=t<'2026-09-25':cuts.append(dict(root=root,time=t,tokens=e.get('tokensBefore'),om=e.get('details',{}).get('type')=='om.folded'))
  if role!='assistant':continue
  ordinal+=1;first_response=pending;pending=False
  if not '2026-07-01'<=t<'2026-09-25':continue
  om_exposed=active or ('--include-early-om' in sys.argv and known_om)
  co='pre' if t<'2026-09-02' and not active else 'om' if om_exposed and t>='2026-09-02' else None
  if not co:continue
  u=m.get('usage',{});tokens=sum(u.get(k,0) or 0 for k in ('input','cacheRead','cacheWrite'))
  if not tokens or m.get('stopReason') in ('error','aborted'):continue
  key=(e.get('id'),t)
  if key in seen:continue
  seen.add(key);n+=1
  rows.append(dict(root=root,sid=h['id'],time=t,cohort=co,model=m.get('model'),cwd=cwd,turn=turn,ordinal=ordinal,first_response=first_response,tokens=tokens,last_lower=last_lower,majority_lower=majority_lower,lower_share=lower_share))
 if n:sessions.append(dict(sid=h['id'],root=root,cwd=cwd,first=first[:180],n=n))
suffix='-early' if '--include-early-om' in sys.argv else ''
Path('/tmp/interactive-context-om'+suffix+'.json').write_text(json.dumps(dict(requests=rows,sessions=sessions,cuts=cuts)))
for co in ('pre','om'):
 rs=[r for r in rows if r['cohort']==co]
 print(co,'all',summary(rs),'user-role-response',summary([r for r in rs if r['first_response']]))
 for model in sorted({r['model'] for r in rs}):print(co,model,summary([r for r in rs if r['model']==model]))
 for lo,hi in [('2026-07-01','2026-08-01'),('2026-08-01','2026-09-02'),('2026-09-02','2026-09-10'),('2026-09-10','2026-09-20'),('2026-09-20','2026-09-25')]:
  sub=[r for r in rs if lo<=r['time']<hi]
  if sub:print(co,lo,summary(sub))
print('SESSIONS')
for r in sessions:print(r['sid'],r['n'],r['cwd'],repr(r['first']))
print('CONTROLS')
for co in ('pre','om'):
 a=[r for r in rows if r['cohort']==co]
 print(co,'below50k',round(sum(r['tokens']<50000 for r in a)/len(a),3))
 for label, pred in [('pi',lambda r:'/dev/mlegls-pi' in r['cwd']),('config',lambda r:'/.config/' in r['cwd'])]:
  print(co,label,summary([r for r in a if pred(r)]))
 selected={(r['root'],r['time']):r for r in cuts if (r['om'] if co=='om' else r['time']<'2026-09-02' and not r['om'])}
 v=[r['tokens'] for r in selected.values() if r['tokens']]
 print(co,'compactions',len(v),'median_tokens_before',S.median(v) if v else None)
for human_only in (False,True,'lowercase'):
 bins=C.defaultdict(lambda:C.defaultdict(list))
 for r in rows:
  if human_only and not r['first_response']:continue
  if human_only=='lowercase' and not (r['last_lower'] and r['majority_lower']):continue
  bins[r['cwd'],min(r['ordinal']//50,10)][r['cohort']].append(r['tokens'])
 shared=[v for v in bins.values() if v['pre'] and v['om']]
 n=sum(len(v['om']) for v in shared)
 print('cwd_age_matched',human_only,'om_n',n,
       {co:round(sum(S.mean(v[co])*len(v['om']) for v in shared)/n) for co in ('pre','om')} if n else {})
print('LOWERCASE CONTROLS')
for co in ('pre','om'):
 a=[r for r in rows if r['cohort']==co]
 for label,pred in [
  ('lowercase-user-response',lambda r:r['first_response'] and r['last_lower']),
  ('majority-lower-roots-all',lambda r:r['majority_lower']),
  ('majority-lower-roots-lowercase-user-response',lambda r:r['majority_lower'] and r['first_response'] and r['last_lower']),
  ('majority-lower-roots-lowercase-initiated-work',lambda r:r['majority_lower'] and r['last_lower']),
 ]:print(co,label,summary([r for r in a if pred(r)]))
