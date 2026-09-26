"""Deterministic boundary sample from the cost audit. Raw packets stay in /tmp."""
import json, collections as C, random, sys
from pathlib import Path
R=Path.home()/'.pi/agent'; O=Path('/tmp/coherence-audit'); O.mkdir(exist_ok=True)
O.chmod(0o700)
# Default: reproduce the frozen sample without the disposable cost-audit output.
rs=json.load(open('/tmp/connectome-om-costs.json'))['requests'] if '--resample' in sys.argv else []
files={}
for p in R.glob('sessions/*/*.jsonl'):
    if p.name[:10]<'2026-09-15': continue
    with p.open() as f:
        try: e=json.loads(f.readline()); files[e['id']]=p
        except (ValueError,KeyError): pass
cache={}
def entries(sid):
    if sid not in cache:
        a=[]
        for i,l in enumerate(files[sid].read_text().splitlines(),1):
            try: a.append(dict(json.loads(l),line=i))
            except ValueError: pass
        cache[sid]=a
    return cache[sid]
def ancestors(es,e):
    by={v.get('id'):v for v in es}; a=[]; seen=set()
    while e and e.get('id') not in seen:
        a.append(e); seen.add(e.get('id')); e=by.get(e.get('parentId'))
    return list(reversed(a))
def material(r):
    es=entries(r['sid']); i=next(i for i,e in enumerate(es) if e.get('timestamp')==r['time'] and e.get('message',{}).get('role')=='assistant')
    before=ancestors(es,es[i])[:-1]; after=[]; cursor=es[i].get('parentId'); n=0
    for e in es[i:]:
        if e.get('parentId') != cursor: continue
        cursor=e['id']; after.append(e)
        if e.get('message',{}).get('role')=='assistant': n+=1
        if n==6: break
    comp=next((e for e in reversed(before) if e.get('type')=='compaction'),None)
    return es[i],before,after,comp,n
eligible=[]
for r in rs:
    if r['model'] not in ('gpt-6-luna','claude-opus-5-5'): continue
    if not ((r['cohort']=='om' and r['compact']) or (r['cohort']=='trial' and r['fold'])): continue
    try: e,b,a,c,n=material(r)
    except (KeyError,StopIteration): continue
    if n<6: continue
    # An actual OM projection, rather than any compaction in an OM-bearing session.
    if r['cohort']=='om' and (not c or c.get('details',{}).get('type')!='om.folded'): continue
    eligible.append(r)
selected=[]
for model in ('gpt-6-luna','claude-opus-5-5'):
    pool=sorted([r for r in eligible if r['cohort']=='trial' and r['model']==model],key=lambda r:(r['time'],r['sid']))
    count=C.Counter(); chosen=[]
    while pool and len(chosen)<10:
        r=min(pool,key=lambda r:(count[r['sid']],r['time'])); pool.remove(r); count[r['sid']]+=1; chosen.append(r)
    op=[r for r in eligible if r['cohort']=='om' and r['model']==model]; counts=C.Counter()
    for r in chosen:
        # Prefer distinct sessions, then nearest request ordinal. No outcome-based selection.
        if not op: break
        q=min(op,key=lambda q:(counts[q['sid']],abs(q['ordinal']-r['ordinal']),q['time'])); op.remove(q); counts[q['sid']]+=1
        pair=len(selected)//2+1; selected.extend([dict(r,pair=pair),dict(q,pair=pair)])
random.Random(20260926).shuffle(selected)
if '--resample' not in sys.argv:
    selected=json.loads(Path(__file__).with_name('sample.json').read_text())
manifest=[]
def text(e):
    m=e.get('message',{}); c=m.get('content',[])
    if isinstance(c,str): return c
    return '\n'.join(b.get('text','') if b.get('type')=='text' else b.get('name','')+' '+json.dumps(b.get('arguments',{}),ensure_ascii=False) if b.get('type')=='toolCall' else '' for b in c)
for k,r in enumerate(selected,1):
    case=f'B{k:02}'; e,b,a,c,n=material(r)
    assert case == r.get('case', case), 'Frozen case order changed'
    assert n == 6 and (not r.get('entry') or e['id'] == r['entry'])
    packet=dict(case=case,source=str(files[r['sid']]),boundary=e['id'],before=b,after=a,compaction=c if r['cohort']=='om' else None)
    (O/f'{case}.json').write_text(json.dumps(packet,ensure_ascii=False))
    start=e['message'].get('timestamp',0)/1000
    manifest.append(dict(r,case=case,path=str(files[r['sid']]),entry=e['id'],start=start))
    # Compact inspection view; explicit truncation, original line numbers and full packet retained.
    msgs=[v for v in b if v.get('message',{}).get('role') in ('user','assistant','toolResult')]
    view=[f'{case} pair={r["pair"]} model={r["model"]} ordinal={r["ordinal"]}']
    for section,seq in [('BEFORE',msgs[-14:]),('AFTER',a)]:
        view.append(section)
        for v in seq:
            m=v.get('message',{}); role=m.get('role'); t=text(v)
            if not role or not t: continue
            limit=900 if role=='user' else 650 if role=='assistant' else 260
            view.append(f'L{v["line"]} {role} {v["id"]}: '+t[:limit]+(' [TRUNCATED]' if len(t)>limit else ''))
    (O/f'{case}.txt').write_text('\n'.join(view))
(O/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('eligible',dict(C.Counter((r['cohort'],r['model']) for r in eligible)))
print('selected',len(manifest),dict(C.Counter((r['cohort'],r['model']) for r in manifest)))
print('distinct sessions', {co:len(set(r['sid'] for r in manifest if r['cohort']==co)) for co in ('om','trial')})
