#!/usr/bin/env python3
"""steer timestamps vs board rows (checkpoint/topic traffic) per session, 09-14..16."""
import json, os, sys, glob
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
from scan import parse, sessions

def t(ts): return datetime.fromisoformat(ts.replace('Z', '+00:00')) if ts else None

board = []
for line in open(os.path.expanduser('~/.local/share/pi-board/log.jsonl')):
    try: j = json.loads(line)
    except: continue
    if '2026-09-14' <= j.get('ts', '')[:10] <= '2026-09-16':
        board.append((j['ts'], j.get('topic', ''), j.get('tags') or [], (j.get('body') or '')[:80]))
out = []
for f in sessions():
    S = parse(f)
    if not S: continue
    handle = os.path.basename(f).rsplit('_', 1)[-1].replace('.jsonl', '')  # sid, unused
    dirname = os.path.basename(os.path.dirname(f)).strip('-')
    work = dirname.split('__worktrees-')[-1]
    steerts = [c['ts'] for c in S['calls'] if c['steer']]
    rows = [b for b in board if work and work in b[1] and ('checkpoint' in b[2] or 'checkpoint' in b[3].lower()[:40])]
    near = 0; dts = []
    for st in steerts:
        if not rows: break
        d = min((abs((t(st) - t(b[0])).total_seconds()) for b in rows), default=None)
        if d is not None: dts.append(d)
        if d is not None and d <= 600: near += 1
    out.append(dict(session=os.path.basename(os.path.dirname(f)), work=work, nsteer=len(steerts),
                    nboard=len(rows), near10m=near, med_gap=sorted(dts)[len(dts)//2] if dts else None))
out.sort(key=lambda r: -r['nboard'])
print(f'{"worktree":38} {"steers":>6} {"board":>6} {"<=10m":>6} {"medgap_s":>9}')
for r in out:
    print(f'{r["work"][:38]:38} {r["nsteer"]:6} {r["nboard"]:6} {r["near10m"]:6} {str(r["med_gap"]):>9}')
ns = sum(r['nsteer'] for r in out); nn = sum(r['near10m'] for r in out); nb = sum(1 for r in out if r['nboard'])
print(f'corpus: {ns} steers, {nn} within 10m of a board row ({nn/max(ns,1):.0%}); {nb}/40 sessions have board traffic')
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'board_corr.json'), 'w'), indent=1)
