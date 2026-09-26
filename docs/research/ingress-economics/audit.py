"""Offline ingress accounting.
Run: uv run --with tiktoken python audit.py [sessions-dir] [exclusive-UTC-cutoff].
The default cutoff is 2026-09-26T11:00:00Z.
No API calls. Token counts use o200k_base, not Jev's billing tokenizer.
Payload reconstruction uses the current judge policy; historical policy differs.
Output contains aggregates only, never session text. Dollar values are scenarios.
"""
import collections as C
import hashlib
import json
import re
import statistics as S
import sys
from pathlib import Path

import tiktoken

ROOT = Path(__file__).resolve().parents[3]
SOURCE = (ROOT / 'lib/ingress.ts').read_text()
ENC = tiktoken.get_encoding('o200k_base')

def tokens(s):
    return len(ENC.encode(s, disallowed_special=()))

def pack(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))

def excerpts(text):
    spans, span = [], ''
    for row in text.splitlines(keepends=True):
        if span and len(span) + len(row) > 500:
            spans.append(span); span = ''
        span += row
        if not re.sub(r'^\d+ [a-z0-9]+│', '', row).strip() and span.strip():
            spans.append(span); span = ''
    if span: spans.append(span)
    while len(spans) > 12:
        at = min(range(len(spans)-1), key=lambda i: len(spans[i])+len(spans[i+1]))
        spans[at:at+2] = [''.join(spans[at:at+2])]
    return spans

FIDELITY = re.search(r'export const FIDELITY = "(.*?)";', SOURCE).group(1)
CRITERIA = dict(re.findall(r'  (\w+): "(.*?)",', SOURCE.split('const criteria = {')[1].split('};')[0]))
FALLBACK = re.search(r'instructions: "(If chunks\[.*?)",', SOURCE).group(1)

def payloads(d):
    for start in range(0, len(d['pages']), 8):
        questions, chunks = {}, []
        for i, p in enumerate(d['pages'][start:start+8]):
            es = excerpts(p['text'])
            chunks.append(dict(label=p['label'], context=p.get('context', []), excerpts=es))
            questions['mode'+str(i)] = dict(type='choice', criteria=CRITERIA,
                instructions=f'Choose fidelity for chunks[{i}] for query and focus. '+FIDELITY)
            if len(es)>1:
                questions['excerpt'+str(i)] = dict(type='choice',
                    instructions=FALLBACK.replace('" + i + "', str(i)),
                    criteria={str(j):f'chunks[{i}].excerpts[{j}]' for j in range(len(es))})
        yield pack(dict(state=dict(query=d['query'], focus=d.get('focus'), chunks=chunks), questions=questions))

def render(d, labels):
    out, originals, ps, i = [], {}, d['pages'], 0
    while i<len(ps):
        p=ps[i]; i+=1
        if p['mode']=='verbatim': out.append(p['text']); continue
        if p['mode']!='omit':
            preview=p['preview'] if 'preview' in p else excerpts(p['text'])[p['judgment']['excerpt']]
            context='\n'.join(x for x in p.get('context',[]) if x not in preview)
            label=('keyword cues; not assertions' if p['mode']=='cues' else
                'skim '+{'skim75':'75','skim50':'50'}[p['mode']]+'%; incomplete, may lose relationships') if p.get('representation')=='tokens' else 'skim; exact excerpt, not complete'
            out.append('\n'+'\n'.join(x for x in [context,'['+label+'; '+p['id']+']',preview] if x)+'\n')
            originals[p['id']]=p['text']; continue
        run=[p]
        while i<len(ps) and ps[i]['mode']=='omit': run.append(ps[i]); i+=1
        original=''.join(p['text'] for p in run)
        id=run[0]['id'] if len(run)==1 else 'ing-'+hashlib.sha256(original.encode()).hexdigest()[:16]
        context='\n'.join(dict.fromkeys(x for p in run for x in p.get('context',[])))
        ls=[p['label'] for p in run if p.get('label')]
        what='; '.join(x[:80] for x in ls[:3])+('; +'+str(len(ls)-3)+' more' if len(ls)>3 else '')
        out.append('\n'+(context+'\n' if context else '')+'[omitted '+id+(': '+what if labels and what else '')+']\n')
        originals[id]=original
    return ''.join(out), originals

def cap(s, n):
    return s.encode()[:n].decode('utf8', errors='ignore') if n else s

def price(m, key):
    u=m.get('usage', {}); n=u.get(key,0)
    return u.get('cost',{}).get(key,0)/n if n else 0

def main():
    base=Path(sys.argv[1]) if len(sys.argv)>1 else Path.home()/'.pi/agent/sessions'
    seen=set(); counts=C.Counter(); sums=C.Counter(); days={}; providers={}; lat=[]; dates=[]
    matched=0; files=0; recovery_seen=set()
    for f in sorted(base.glob('*/*.jsonl')):
        # The fixed cutoff makes the audit reproducible and excludes its own traffic.
        text=f.read_text()
        if '"exec-ingress"' not in text: continue
        rows=[]
        for line in text.splitlines():
            try:
                row=json.loads(line)
                if row.get('timestamp','') < (sys.argv[2] if len(sys.argv)>2 else '2026-09-26T11:00:00'):
                    rows.append(row)
            except json.JSONDecodeError: pass
        next_assistant={}; following=None
        for i in range(len(rows)-1,-1,-1):
            next_assistant[i]=following
            m=rows[i].get('message',{})
            if m.get('role')=='assistant' and m.get('usage'): following=m
        active=False; originals={}
        for i,r in enumerate(rows):
            d=r.get('data',{})
            if r.get('customType')!='exec-ingress': continue
            key=(r.get('id'),r.get('timestamp'))
            if key in seen: continue
            seen.add(key)
            kind=d.get('type'); v=d.get('version'); counts[f'{kind}_v{v}']+=1
            if kind!='filter' or v!=3: continue
            active=True; dates.append(r['timestamp']); lat.append(d['elapsedMs'])
            original=''.join(p['text'] for p in d['pages'])
            try:
                output, retained=render(d, True)
                if len(output.encode())!=d['outputBytes']: output, retained=render(d, False)
            except (IndexError, KeyError):
                counts['reconstruction_error']+=1; continue
            if len(output.encode())!=d['outputBytes']:
                counts['reconstruction_mismatch']+=1; continue
            matched+=1; originals.update(retained)
            a,b=tokens(original),tokens(output)
            ca,cb=tokens(cap(original,d.get('budget'))),tokens(cap(output,d.get('budget')))
            payload=list(payloads(d)); jt=sum(tokens(p) for p in payload)
            vals=dict(filters=1,input_bytes=d['inputBytes'],output_bytes=d['outputBytes'],
                input_tokens=a,output_tokens=b,saved_tokens=a-b,cap_saved_tokens=ca-cb,
                jev_tokens=jt,batches=len(payload),unchanged=int(original==output),
                over_budget=int(bool(d.get('budget')) and d['inputBytes']>d['budget']))
            m=next_assistant[i] or {}; provider=m.get('provider','unknown')+'/'+m.get('model','unknown')
            # One fresh input ingestion only; cache-write premium and subsequent reads excluded.
            rate=price(m,'input') or price(m,'cacheWrite')
            vals['fresh_value']=max(0,ca-cb)*rate
            vals['cache_once_value']=max(0,ca-cb)*price(m,'cacheRead')
            vals['uncapped_fresh_value']=max(0,a-b)*rate
            vals['unchanged_jev_tokens']=jt if original==output else 0
            sums.update(vals)
            days.setdefault(r['timestamp'][:10],C.Counter()).update(vals)
            providers.setdefault(provider,C.Counter()).update(vals)
        if active:
            files+=1
            # Explicit pull results: both legacy exec pull and bash ab pull. Conservative
            # tax charges the whole associated tool result and following model request.
            calls={}
            for i,r in enumerate(rows):
                m=r.get('message',{})
                content=m.get('content',[])
                if m.get('role')=='assistant' and isinstance(content,list):
                    for block in content:
                        if block.get('type')=='toolCall':
                            args=pack(block.get('arguments',{}))
                            if re.search(r'\bab pull\b|\bpull\s*\(',args) and 'ing-' in args:
                                calls[block.get('id')]=True
                if m.get('role')=='toolResult' and m.get('toolCallId') in calls:
                    k=(r.get('id'),r.get('timestamp'))
                    if k in recovery_seen: continue
                    recovery_seen.add(k)
                    body=content if isinstance(content,str) else '\n'.join(b.get('text','') for b in content)
                    counts['explicit_pull_results']+=1
                    sums['pull_result_tokens']+=tokens(body)
                    nm=next_assistant[i] or {}
                    sums['pull_next_request_cost']+=nm.get('usage',{}).get('cost',{}).get('total',0)
                    sums['pull_fresh_value']+=tokens(body)*(price(nm,'input') or price(nm,'cacheWrite'))
    print(json.dumps(dict(files=files,matched=matched,first=min(dates),last=max(dates),counts=counts,
        totals=sums,days=days,providers=providers,latency_ms=dict(median=S.median(lat),p95=sorted(lat)[int(.95*len(lat))],sum=sum(lat))),indent=2))

if __name__=='__main__': main()
