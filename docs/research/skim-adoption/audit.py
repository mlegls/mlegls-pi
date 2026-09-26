"""Offline post-fix ingress adoption inventory. No API calls or runtime changes.

python3 audit.py [--trace SESSION_PREFIX] [--around LINE] [--radius N]
Fixed cohort: sessions born Sep 25–26, entries before Sep 26 15:00 UTC.
Session bodies stay local; default output is metadata/counts only.
"""
import argparse
import collections as C
import json
import re
from pathlib import Path

START = '2026-09-25T00:00:00'
END = '2026-09-26T15:00:00'
ROOT = Path.home() / '.pi/agent/sessions'
PULL = re.compile(r'\bab pull\b|\b(?:show\.)?pull\s*\(')
RAW = re.compile(r'\bab raw\b|\bshow\.raw\s*\(')


def text(content):
    if isinstance(content, str): return content
    return '\n'.join(b.get('text', b.get('thinking', '')) for b in content if b.get('type') in ('text', 'thinking'))


def load(path):
    rows = []
    for n, line in enumerate(path.open(), 1):
        try: r = json.loads(line)
        except json.JSONDecodeError: continue
        if r.get('timestamp', '') < END: rows.append((n, r))
    return rows


def calls(rows):
    out = []
    seen = set()
    for n, r in rows:
        m = r.get('message', {})
        if m.get('role') != 'assistant' or not isinstance(m.get('content'), list): continue
        for b in m['content']:
            if b.get('type') != 'toolCall' or b['name'] not in ('bash', 'exec'): continue
            if b['id'] in seen: continue
            seen.add(b['id'])
            a = b.get('arguments', {})
            code = a.get('command', a.get('code', ''))
            out.append(dict(line=n, entry=r.get('id'), id=b['id'], adapter=b['name'], model=m.get('model', 'unknown'),
                            code=code, raw_all=a.get('raw') is True, raw_any=a.get('raw') is True or bool(RAW.search(code)),
                            pull=bool(PULL.search(code) and 'ing-' in code), focus=a.get('focus')))
    return out


def inventory(path, rows):
    header = rows[0][1]
    rows = [(n, r) for n, r in rows if r.get('timestamp', '') >= header['timestamp']]
    cs = calls(rows)
    if not cs: return None
    seen = set(); events = []; visible = []
    for n, r in rows:
        key = (r.get('id'), r.get('timestamp'))
        if key in seen: continue
        seen.add(key)
        d = r.get('data', {})
        if r.get('customType') == 'exec-ingress' and d.get('type') == 'filter' and d.get('version') == 3:
            events.append((n, d))
        m = r.get('message', {})
        if m.get('role') == 'toolResult':
            s = text(m.get('content', []))
            if re.search(r'\[(?:skim|keyword cues|omitted)\b', s) and 'ing-' in s:
                visible.append(dict(line=n, call=m.get('toolCallId'), skim=bool(re.search(r'\[(?:skim|keyword cues)\b', s))))
    return dict(session=header.get('id'), file=path.name, started=header['timestamp'], parent=header.get('parentSession'),
                adapters=dict(C.Counter(c['adapter'] for c in cs)), models=dict(C.Counter(c['model'] for c in cs)),
                calls=len(cs), raw_all=sum(c['raw_all'] for c in cs), raw_any=sum(c['raw_any'] for c in cs), pulls=sum(c['pull'] for c in cs),
                first_raw=next((i + 1 for i, c in enumerate(cs) if c['raw_any']), None),
                filters=len(events), changed_filters=sum(any(p['mode'] != 'verbatim' for p in d['pages']) for _, d in events),
                modes=dict(C.Counter(p['mode'] for _, d in events for p in d['pages'])), visible=visible)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--trace'); parser.add_argument('--around', type=int); parser.add_argument('--radius', type=int, default=18)
    args = parser.parse_args()
    result = []
    for p in sorted(ROOT.glob('*/*.jsonl')):
        if not ('2026-09-25' <= p.name[:10] <= '2026-09-26'): continue
        # A resumed/compacted file may carry an older header; exclude later files too.
        if p.name[:19] >= '2026-09-26T15-00-00': continue
        if args.trace and args.trace not in p.name: continue
        rows = load(p)
        if not rows or not (START <= rows[0][1].get('timestamp', '') < END): continue
        if args.trace:
            cs = {c['id']: c for c in calls(rows)}
            for n, r in rows:
                if args.around and abs(n - args.around) > args.radius: continue
                m = r.get('message', {}); d = r.get('data', {})
                if r.get('customType') == 'exec-ingress':
                    print(n, 'FILTER', d.get('type'), [(p['mode'], p['label'][:100]) for p in d.get('pages', [])]); continue
                if not m: continue
                if m['role'] == 'assistant':
                    s = text(m.get('content', []))
                    if s: print(n, 'ASSISTANT', s)
                    for b in m.get('content', []):
                        if b.get('type') == 'toolCall' and b.get('id') in cs: print(n, 'CALL', json.dumps(cs[b['id']], ensure_ascii=False))
                elif m['role'] == 'toolResult':
                    s = text(m.get('content', []))
                    # Full relevant tool bodies on demand; default trace remains navigable.
                    print(n, 'RESULT', m.get('toolCallId'), s if args.around else s[:600])
                elif m['role'] == 'user': print(n, 'USER', text(m.get('content', []))[:1500])
        else:
            s = inventory(p, rows)
            if s: result.append(s)
    if not args.trace:
        eligible = [s for s in result if not s['parent'] and s['calls'] >= 10 and s['changed_filters'] and s['visible'] and len(s['models']) == 1]
        sample = []
        for family in ['astra', 'opus', 'sol', 'luna', 'glm']:
            matches = [s for s in eligible if family in next(iter(s['models']))]
            sample.extend(s['session'] for s in sorted(matches, key=lambda s: s['started'], reverse=True)[:2])
        print(json.dumps(dict(start=START, cutoff=END, sample=sample, sessions=result), indent=2))


if __name__ == '__main__': main()
