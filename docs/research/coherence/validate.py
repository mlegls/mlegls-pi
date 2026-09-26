"""Check extraction invariants and the report's quantitative/source claims."""
import collections as C
import json
from pathlib import Path

root = Path('/tmp/coherence-audit')
sample = json.loads((root / 'manifest.json').read_text())
assert len(sample) == 40 and len({r['entry'] for r in sample}) == 40
roots, followups = C.defaultdict(set), C.defaultdict(set)
user_last, cohorts = C.Counter(), C.Counter()
for r in sample:
    p = json.loads((root / (r['case'] + '.json')).read_text())
    after = p['after']
    assert after[0]['id'] == r['entry']
    assert all(b['parentId'] == a['id'] for a, b in zip(after, after[1:]))
    assistants = [e for e in after if e.get('message', {}).get('role') == 'assistant']
    assert len(assistants) == 6
    followups[r['cohort']].update(e['id'] for e in assistants)
    before = [e for e in p['before'] if e.get('message', {}).get('role') in ('user', 'assistant', 'toolResult')]
    roots[r['cohort']].add(next(e['id'] for e in before if e['message']['role'] == 'user'))
    user_last[r['cohort']] += before[-1]['message']['role'] == 'user'
    cohorts[r['cohort'], r['model']] += 1
    if r['cohort'] == 'om':
        assert p['compaction']['details']['type'] == 'om.folded'
    else:
        s = json.loads((root / (r['case'] + '-store.json')).read_text())
        assert s['recovery'] is None
        assert s['start'] == r['start']
        for key, values in s['states'].items():
            if key.endswith(':summaries'):
                assert all(z['created'] / 1000 <= r['start'] for z in values)
assert set(cohorts.values()) == {10}
assert user_last == {'om': 19, 'trial': 1}
assert {k: len(v) for k, v in roots.items()} == {'om': 20, 'trial': 10}
assert {k: len(v) for k, v in followups.items()} == {'om': 120, 'trial': 114}
p = json.loads((root / 'B02.json').read_text())
o = next(o for o in p['compaction']['details']['observations'] if o['id'] == 'd99b030bcb7f')
assert 'graded Hard' in o['content'] and 'recorded 简单' in o['content']
assert o['sourceEntryIds'] == ['d94d8c74', 'b366a81b']
source = next(e for e in p['before'] if e['id'] == 'b366a81b')
assert '已记录：简单' in ''.join(b.get('text', '') for b in source['message']['content'])
print('Validated 40 boundaries, linear continuations, cohort counts, historical summary times, and cited OM grade mismatch.')
