"""python3 receipt.py /tmp/skim-adoption-inventory.json > receipt.jsonl"""
import collections as C
import hashlib
import json
import sys
from pathlib import Path
import audit

inventory = json.loads(Path(sys.argv[1]).read_text())
reviews = json.loads(Path(__file__).with_name('reviews.json').read_text())
assert {r['session'] for r in reviews} == set(inventory['sample'])
eligible = [s for s in inventory['sessions'] if not s['parent'] and s['calls'] >= 10 and s['changed_filters'] and s['visible'] and len(s['models']) == 1]
groups = {}
for family in ['astra', 'opus', 'sol', 'luna', 'glm']:
    ss = [s for s in eligible if family in next(iter(s['models']))]
    groups[family] = dict(sessions=len(ss), whole_raw_85=sum(s['raw_all']/s['calls'] >= .85 for s in ss), lexical_raw_85=sum(s['raw_any']/s['calls'] >= .85 for s in ss))
print(json.dumps(dict(type='cohort', start=inventory['start'], cutoff=inventory['cutoff'], files=len(inventory['sessions']), roots=sum(not s['parent'] for s in inventory['sessions']), eligible=len(eligible), groups=groups, adapters=dict(C.Counter(a for s in inventory['sessions'] for a in s['adapters'])))))
seen_calls = set()
for review in reviews:
    s = next(s for s in inventory['sessions'] if s['session'] == review['session'])
    p = next(audit.ROOT.glob('*/' + s['file']))
    rows = audit.load(p)
    cs = audit.calls(rows)
    ids = {c['id'] for c in cs}
    assert not seen_calls.intersection(ids), 'inherited history in sample'
    seen_calls.update(ids)
    print(json.dumps(dict(type='sample', **s)))
    for n, r in rows:
        if n not in review['lines']: continue
        m = r.get('message', {}); d = r.get('data', {})
        evidence = dict(type='evidence', session=s['session'], line=n, entry=r.get('id'), timestamp=r.get('timestamp'), sha256=hashlib.sha256(json.dumps(r, sort_keys=True).encode()).hexdigest())
        if r.get('customType') == 'exec-ingress':
            evidence.update(kind=d['type'], pages=[dict(mode=q['mode'], label=q['label']) for q in d.get('pages', [])])
        else:
            evidence['role'] = m.get('role')
            # Store call identities/flags, not executable copies of historical commands.
            evidence['calls'] = [{k: v for k, v in c.items() if k != 'code'} for c in audit.calls([(n, r)])]
            if m.get('role') == 'assistant':
                # Only short operational statements; longer reasoning/answers remain local.
                t = audit.text(m.get('content', []))
                if 0 < len(t) <= 1000: evidence['text'] = t
            if m.get('role') == 'toolResult':
                evidence['call'] = m.get('toolCallId')
                evidence['markers'] = [line for line in audit.text(m.get('content', [])).splitlines() if line.startswith(('[skim', '[omitted', '[keyword cues'))]
        print(json.dumps(evidence, ensure_ascii=False))
