#!/usr/bin/env python3
"""Coverage + stats for decision-broadcasts-read. Reads extract.py outputs; prints summary,
writes coverage.json (per-decision evidence classes).

Evidence classes per decision (reader = session other than the sender, ts >= decision ts):
  strong pull   decision id in a board_read result, or body verbatim in the result of a
                board_read / exec board.read tool call   (peer pulled it and it was returned)
  push          wake-push (custom_message board injection) of the decision into a peer session
  poll-only     peer made a topic-matching read whose returned ids are unknown or exclude it
  log-grep      body appeared in a bash tool result (e.g. jq over log.jsonl) — excluded from headline
Usage: python3 analyze.py [OUTDIR]
"""
import json, os, re, statistics, sys
from collections import Counter, defaultdict
from datetime import datetime

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(OUT, 'events.json')))
D, R, FM = E['decisions'], E['reads'], E['filemeta']
occ = json.load(open(os.path.join(OUT, 'text_occ.json')))
pushes = json.load(open(os.path.join(OUT, 'pushes.json')))
LOG = os.path.expanduser('~/.local/share/pi-board/log.jsonl')
ack_msgs = [d for d in map(json.loads, open(LOG, errors='replace'))
            if 'ack' in d.get('tags', []) and '2026-09-14T00:00' <= d['ts'] < '2026-09-16T00:00']

def norm(s): return re.sub(r'\s+', ' ', s or '').strip()
def topic_matches(rt, dt):
    if not rt: return False
    rt = rt.rstrip('/')
    if '*' in rt:
        rx = re.escape(rt).replace(r'\*\*', '.+').replace(r'\*', '[^/]*')
        return re.fullmatch(rx, dt) is not None
    return dt == rt or dt.startswith(rt + '/')
def parse(t): return datetime.fromisoformat(t.replace('Z', '+00:00'))
cwd_of = {m.get('session_id'): m.get('cwd') or '' for m in FM.values()}
def is_peer(s): return '/mmon/concept' in cwd_of.get(s, '')

def kind_class(k):
    if k == 'push': return 'push-record'
    if k.startswith('toolresult:board_read') or k.startswith('toolresult:exec'): return 'read-result'
    if k.startswith('toolresult:bash') or k == 'text-toolResult': return 'log-grep'
    if k.startswith('toolcall-arg:'): return 'quoted-in-send'
    return 'conversation-text'

cov = []
for d in D:
    ts, topic, snd = d['ts'], d['topic'], d['sender_session']
    ev = defaultdict(set); ev_detail = []
    for o in occ.get(d['id'], []):
        if o['ts'] < ts: continue
        cls, s = kind_class(o['kind']), o['session']
        if s == snd: ev[cls + '-by-sender'].add(s)
        else:
            ev[cls].add(s)
            ev_detail.append({'ts': o['ts'], 'session': s, 'class': cls, 'peer': is_peer(s), 'kind': o['kind']})
    topic_poll = set()
    for r in R:
        if r['ts'] < ts or r['session'] == snd: continue
        if r['res_ids']:
            if d['id'] in r['res_ids']:
                ev['read-result'].add(r['session']); ev_detail.append({'ts': r['ts'], 'session': r['session'], 'class': 'read-result', 'peer': is_peer(r['session']), 'kind': 'res_ids'})
            elif topic_matches(r['topic'], topic): topic_poll.add(r['session'])
        elif topic_matches(r['topic'], topic): topic_poll.add(r['session'])
    ps = [p for p in pushes if p['msgid'] == d['id'] and p['ts'] and parse(p['ts']) >= parse(ts) and p['session'] != snd]
    push_ses = sorted(set(p['session'] for p in ps))
    ackd = [{'ts': a['ts'], 'from': (a.get('from') or {}).get('name')} for a in ack_msgs if a['ts'] >= ts and d['id'] in a.get('body', '')]
    cov.append({'id': d['id'], 'ts': ts, 'topic': topic, 'sender': d.get('sender_name'), 'sender_session': snd,
                'strong_readers': sorted(ev['read-result']),
                'loggrep_readers': sorted(ev['log-grep']), 'quote_senders': sorted(ev['quoted-in-send']),
                'conversation_relay': sorted(ev['conversation-text']),
                'topic_poll_only': sorted(topic_poll), 'push_sessions': push_ses,
                'push_peer_sessions': sorted(s for s in push_ses if is_peer(s)),
                'ack_msgs': ackd,
                'ev_detail': sorted(ev_detail, key=lambda x: x['ts'])})

for c in cov:
    c['strong_peer_readers'] = sorted(s for s in c['strong_readers'] if is_peer(s))
json.dump(cov, open(os.path.join(OUT, 'coverage.json'), 'w'))

n = len(cov)
pull = [c for c in cov if c['strong_peer_readers']]
push = [c for c in cov if c['push_peer_sessions']]
neither = [c for c in cov if not c['strong_peer_readers'] and not c['push_peer_sessions']]
reached = Counter(len(set(c['strong_peer_readers']) | set(c['push_peer_sessions'])) for c in cov)
print(f'decisions: {n}  window {min(c["ts"] for c in cov)[5:16]}..{max(c["ts"] for c in cov)[5:16]}')
print(f'peer pull evidence: {len(pull)} ({len(pull)/n:.0%});  peer push: {len(push)} ({len(push)/n:.0%});  both: {len([c for c in cov if c["strong_peer_readers"] and c["push_peer_sessions"]])};  neither: {len(neither)}')
print(f'reached >=1 peer: {n-len(neither)} ({(n-len(neither))/n:.0%});  >=3 peers: {sum(1 for c in cov if len(set(c["strong_peer_readers"])|set(c["push_peer_sessions"]))>=3)} ({sum(1 for c in cov if len(set(c["strong_peer_readers"])|set(c["push_peer_sessions"]))>=3)/n:.0%})')
print(f'reach distribution: {dict(sorted(reached.items()))}')
print(f'ack-tagged log messages, board-wide 09-14..15: {len(ack_msgs)}  (factor-finish topics: {sum(1 for a in ack_msgs if "factor-finish" in a.get("topic",""))})  vs decisions reached by a peer: {n-len(neither)}/{n}')
print(f'conversation/spawn relays: {sum(1 for c in cov if c["conversation_relay"])};  quoted-in-send by non-sender: {sum(1 for c in cov if c["quote_senders"])};  ack-msg per id: {sum(1 for c in cov if c["ack_msgs"])}')
lat = []
for c in pull:
    t0 = parse(c['ts'])
    lat.append(min((parse(x['ts']) - t0).total_seconds() / 60 for x in c['ev_detail'] if x['class'] == 'read-result' and x['session'] in c['strong_peer_readers']))
print(f'pull latency min: median {statistics.median(lat):.1f}  p10 {sorted(lat)[len(lat)//10]:.1f}  p90 {sorted(lat)[9*len(lat)//10]:.1f}')
pl = []
for c in push:
    t0 = parse(c['ts'])
    pl.append(min((parse(p['ts']) - t0).total_seconds() / 60 for p in pushes if p['msgid'] == c['id'] and p['session'] in c['push_peer_sessions'] and p['ts'] and parse(p['ts']) >= t0))
print(f'push latency min: median {statistics.median(pl):.2f}')
roll = defaultdict(lambda: {'d': 0, 'read': 0, 'readers': set()})
for c in cov:
    t = '/'.join(c['topic'].split('/')[:3])
    roll[t]['d'] += 1
    if c['strong_peer_readers'] or c['push_peer_sessions']:
        roll[t]['read'] += 1; roll[t]['readers'] |= set(c['strong_peer_readers']) | set(c['push_peer_sessions'])
print('per-topic rollup (decisions / reached / distinct readers):')
for t, v in sorted(roll.items(), key=lambda kv: -kv[1]['d'])[:10]:
    print(f'  {v["d"]:3d} {v["read"]:3d} {len(v["readers"]):3d}  {t}')
print('neither-pull-nor-push decisions:')
for c in neither: print(f'  {c["ts"][5:16]} {c["id"]} {c["topic"]} (sender {c["sender"]})')
