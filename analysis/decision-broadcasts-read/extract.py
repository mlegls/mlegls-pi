#!/usr/bin/env python3
"""Decision-broadcast read-evidence extraction for the factor-finish run (09-14..09-15).

Sources (all static, no backend restart):
  ~/.local/share/pi-board/log.jsonl    board message log (decisions, ack-tagged messages)
  ~/.pi/agent/sessions/**/*.jsonl      pi session records (board_* tool calls, exec text,
                                       custom_message board pushes, conversation text)

Writes (in OUT dir, default alongside this script):
  events.json    decisions, read events, ack events, subs, ff conversation texts, file meta
  pushes.json    custom_message board wake-pushes (id, ts, session)
  text_occ.json  per decision: where its body text appears in the corpus (first-60-chars match)
  coverage.json  per decision: evidence classes (see analyze.py)

Usage: python3 extract.py [OUTDIR]
"""
import json, os, re, subprocess, sys
from collections import defaultdict

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
SES = os.path.expanduser('~/.pi/agent/sessions')
LOG = os.path.expanduser('~/.local/share/pi-board/log.jsonl')

def norm(s): return re.sub(r'\s+', ' ', s or '').strip()

# ---------- decisions ----------
decisions, ff_topics = [], defaultdict(int)
for line in open(LOG, errors='replace'):
    d = json.loads(line)
    t = d.get('topic', '')
    if 'factor-finish' in t:
        ff_topics[t] += 1
        if 'decision' in d.get('tags', []):
            decisions.append({'id': d['id'], 'ts': d['ts'], 'topic': t, 'tags': d.get('tags', []),
                              'sender_session': (d.get('from') or {}).get('session'),
                              'sender_name': (d.get('from') or {}).get('name'), 'body': d.get('body', '')})
decisions.sort(key=lambda x: x['ts'])

# ---------- candidate files ----------
def grep(args):
    return subprocess.run(['grep'] + args, capture_output=True, text=True).stdout.splitlines()
board_pat = r'board_read|board\.read|board_ack|board\.ack|board_list|board\.list|board_subscribe|board-subs|board\.subscribe'
cand = set(grep(['-rlE', board_pat, SES, '--include=*.jsonl'])) | set(grep(['-rl', 'factor-finish', SES, '--include=*.jsonl']))

# ---------- per-file event + text extraction ----------
reads, acks, subs, texts, filemeta = [], [], [], [], {}
topic_re = re.compile(r'topic\s*["\']?\s*[:=]\s*["\']([A-Za-z0-9_./\-*]+)["\']')
frag_needles = [norm(d['body'].strip().split('\n')[0])[:60] for d in decisions]
frag_needles = [f for f in frag_needles if len(f) >= 25]
frag_by_prefix = defaultdict(list)
for d, f in zip(decisions, [norm(d['body'].strip().split('\n')[0])[:60] for d in decisions]):
    if len(f) >= 25: frag_by_prefix[f].append(d['id'])

for f in sorted(cand):
    sid = cwd = None; meta = None
    results = {}
    lines = open(f, errors='replace').read().splitlines()
    parsed = []
    for line in lines:
        if 'board' not in line and '"session"' not in line and 'session-meta' not in line:
            parsed.append(None); continue
        try: d = json.loads(line)
        except: parsed.append(None); continue
        parsed.append(d)
        if d.get('type') == 'session': sid, cwd = d.get('id'), d.get('cwd')
        if d.get('type') == 'custom' and d.get('customType') == 'session-meta': meta = d.get('data')
        m = d.get('message') or {}
        if m.get('role') == 'toolResult' and 'board' in str(m.get('toolName', '')):
            results[m.get('toolCallId')] = m
    filemeta[f] = {'session_id': sid, 'cwd': cwd, 'meta': meta}
    for d in parsed:
        if d is None: continue
        ts = d.get('timestamp') or ''
        m = d.get('message') or {}
        role = m.get('role'); content = m.get('content')
        items = content if isinstance(content, list) else []
        for c in items:
            if not isinstance(c, dict) or c.get('type') != 'toolCall': continue
            nm = str(c.get('name', '')); a = c.get('arguments')
            if isinstance(a, str):
                try: a = json.loads(a)
                except: a = {}
            a = a or {}
            if nm in ('board_read', 'board.read'):
                r = results.get(c.get('id')); det = (r or {}).get('details')
                rids = [x.get('id') for x in det.get('messages', [])] if isinstance(det, dict) and isinstance(det.get('messages'), list) else None
                reads.append({'ts': ts, 'session': sid, 'cwd': cwd, 'file': f, 'tool': nm,
                              'topic': a.get('topic'), 'tags': a.get('tags'), 'since': a.get('since'),
                              'limit': a.get('limit'), 'res_topic': det.get('topic') if isinstance(det, dict) else None,
                              'res_count': det.get('count') if isinstance(det, dict) else None, 'res_ids': rids})
            elif nm in ('board_ack', 'board.ack'):
                ids = a.get('ids') or a.get('id')
                acks.append({'ts': ts, 'session': sid, 'file': f, 'ids': ([ids] if isinstance(ids, str) else (ids or []))})
            elif nm in ('board_subscribe', 'board.subscribe'):
                subs.append({'ts': ts, 'session': sid, 'file': f, 'topic': a.get('topic')})
            elif nm in ('bash', 'exec', 'command'):
                cmd = a.get('command') or json.dumps(a)
                for mt in re.finditer(r'board[. ](read|ack)', cmd):
                    seg = cmd[mt.start():mt.start() + 400]
                    if mt.group(1) == 'ack':
                        acks.append({'ts': ts, 'session': sid, 'file': f,
                                     'ids': re.findall(r'"(mu[0-9a-z]+-[0-9a-z]+)"', seg)})
                    else:
                        tm = topic_re.search(seg)
                        reads.append({'ts': ts, 'session': sid, 'cwd': cwd, 'file': f, 'tool': f'exec:{mt.group(0)}',
                                      'topic': tm.group(1) if tm else None, 'tags': None, 'since': None, 'limit': None,
                                      'res_topic': None, 'res_count': None, 'res_ids': None})
        if role in ('user', 'assistant'):
            t = ' '.join(x.get('text', '') for x in items if isinstance(x, dict) and x.get('type') == 'text') if items else (content if isinstance(content, str) else '')
            if 'factor-finish' in t and len(t) > 40:
                texts.append({'ts': ts, 'session': sid, 'file': f, 'role': role, 'text': t[:4000]})
        if d.get('type') == 'custom' and d.get('customType') == 'board-subs':
            for s in d.get('data') or []:
                subs.append({'ts': ts, 'session': sid, 'file': f, 'topic': s.get('topic'), 'wake': s.get('wake')})

# ---------- pushes (custom_message board injections) ----------
pushes = []
for f in grep(['-rl', 'custom_message', SES, '--include=*.jsonl']):
    sid = cwd = None
    for line in open(f, errors='replace'):
        if 'custom_message' not in line:
            if '"type": "session"' in line or '"type":"session"' in line:
                try: d = json.loads(line); sid, cwd = d.get('id'), d.get('cwd')
                except: pass
            continue
        try: d = json.loads(line)
        except: continue
        if d.get('type') != 'custom_message' or d.get('customType') != 'board': continue
        content = d.get('content', '')
        m = re.match(r'^\[board\] (\S+)', content)
        pushes.append({'ts': d.get('timestamp'), 'session': sid, 'cwd': cwd, 'file': f,
                       'msgid': m.group(1) if m else None, 'ff': 'factor-finish' in content})

# ---------- body-fragment occurrences anywhere in corpus ----------
patfile = os.path.join(OUT, 'frags.txt')
with open(patfile, 'w') as fh:
    for p in frag_by_prefix: fh.write(p + '\n')
occ_files = grep(['-rlF', '-f', patfile, SES, '--include=*.jsonl'])
occ = defaultdict(list)
for f in occ_files:
    sid = cwd = None
    recs = []
    for line in open(f, errors='replace'):
        try:
            d = json.loads(line)
        except:
            continue
        recs.append(d)
        if d.get('type') == 'session': sid, cwd = d.get('id'), d.get('cwd')
    for d in recs:
        ts = d.get('timestamp') or ''; m = d.get('message') or {}
        blobs = []
        c = m.get('content')
        if isinstance(c, str): blobs.append(('text-' + str(m.get('role')), c))
        elif isinstance(c, list):
            for x in c:
                if isinstance(x, dict) and x.get('type') == 'text': blobs.append(('text-' + str(m.get('role')), x.get('text', '')))
                elif isinstance(x, dict) and x.get('type') == 'toolCall': blobs.append(('toolcall-arg:' + str(x.get('name')), json.dumps(x.get('arguments'))))
        if m.get('role') == 'toolResult':
            for x in (m.get('content') or []):
                if isinstance(x, dict) and x.get('type') == 'text': blobs.append(('toolresult:' + str(m.get('toolName')), x.get('text', '')))
        if d.get('type') == 'custom_message' and d.get('customType') == 'board':
            blobs.append(('push', d.get('content', '')))
        for kind, txt in blobs:
            nt = norm(txt)
            if not nt: continue
            for p, ids in frag_by_prefix.items():
                if p in nt:
                    for did in ids:
                        occ[did].append({'ts': ts, 'session': sid, 'file': f, 'kind': kind, 'cwd': cwd})

json.dump({'decisions': decisions, 'reads': reads, 'acks': acks, 'subs': subs, 'texts': texts,
           'filemeta': filemeta, 'ff_topic_counts': dict(ff_topics)},
          open(os.path.join(OUT, 'events.json'), 'w'))
json.dump(pushes, open(os.path.join(OUT, 'pushes.json'), 'w'))
json.dump(occ, open(os.path.join(OUT, 'text_occ.json'), 'w'))
print(f'decisions: {len(decisions)}  ff topics: {len(ff_topics)} ({sum(ff_topics.values())} msgs)')
print(f'reads: {len(reads)}  acks: {len(acks)}  subs: {len(subs)}  pushes: {len(pushes)} ({sum(1 for p in pushes if p["ff"])} ff)')
print(f'occurrence decisions: {len(occ)}  files: {len(occ_files)}')
