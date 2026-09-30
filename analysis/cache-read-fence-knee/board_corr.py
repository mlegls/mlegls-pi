#!/usr/bin/env python3
"""steer timestamps vs board rows (checkpoint/topic traffic) per session, 09-14..16."""
import argparse
import json
import os
import sys
from datetime import datetime
sys.dont_write_bytecode = True
from scan import parse, sessions
from final import analyze, tabulate

def t(ts): return datetime.fromisoformat(ts.replace('Z', '+00:00')) if ts else None

def gap(ts, event_ts):
    return (t(event_ts) - t(ts)).total_seconds()


def nearest(ts, events):
    if not events: return None
    event = min(events, key=lambda e: abs(gap(ts, e['ts'])))
    return dict(**event, gap_seconds=gap(ts, event['ts']))


def correlate(S, board):
    work = S['cwd'].split('__worktrees/')[-1].split('__worktrees-')[-1]
    # Exact path components avoid e.g. review-1 matching review-10. Bound to the
    # session lifetime so a restarted handle cannot borrow another lap's rows.
    live = [b for b in board if t(S['start']) <= t(b['ts']) <= t(S['end'])]
    own = [b for b in live if b.get('cwd') == S['cwd'] or b['topic'].split('/')[-1] == work]
    runs = sorted({b['topic'].rsplit('/', 1)[0] for b in own if '/' in b['topic']})
    checkpoints = [b for b in own if b['checkpoint']]
    run_checkpoints = [b for b in live if b['checkpoint'] and any(b['topic'].startswith(run + '/') for run in runs)]
    events = [dict(ts=b['ts'], id=b['id'], topic=b['topic']) for b in checkpoints]
    run_events = [dict(ts=b['ts'], id=b['id'], topic=b['topic']) for b in run_checkpoints]
    steers = [dict(ts=s['ts'], assistant_index=i) for s, i in zip(S['steers'], S['steer_at'])]
    curve = tabulate(S); A = analyze(S)
    knees = dict(slope=A['knee_slope2'], changepoint=A['knee_cp'], optimum=A['knee_star'],
                 **{f'context_{th}k': k for th, k in A['kx'].items()})
    associations = {}
    for label, k in knees.items():
        if k is None:
            associations[label] = None
            continue
        point = curve[k-1]
        associations[label] = dict(**point, nearest_steer=nearest(point['timestamp'], steers),
                                   nearest_checkpoint=nearest(point['timestamp'], events),
                                   nearest_run_checkpoint=nearest(point['timestamp'], run_events),
                                   adjacent_calls=curve[max(0, k-2):min(len(curve), k+1)])
    linked_steers = [dict(**s, nearest_checkpoint=nearest(s['ts'], events)) for s in steers]
    return dict(sid=S['sid'], session=os.path.basename(os.path.dirname(S['file'])), work=work,
                runs=runs, nsteer=len(steers), nboard=len(events), checkpoints=events,
                run_checkpoints=run_events, steers=linked_steers,
                near10m=sum(s['nearest_checkpoint'] is not None and abs(s['nearest_checkpoint']['gap_seconds']) <= 600 for s in linked_steers),
                knees=associations)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sessions-root', default=os.path.expanduser('~/.pi/agent/sessions'))
    parser.add_argument('--board-log', default=os.path.expanduser('~/.local/share/pi-board/log.jsonl'))
    parser.add_argument('--output-dir', default=os.path.dirname(os.path.abspath(__file__)))
    args = parser.parse_args()
    board = []
    with open(args.board_log) as fh:
        for line in fh:
            try: j = json.loads(line)
            except json.JSONDecodeError: continue
            if '2026-09-14' <= j.get('ts', '')[:10] <= '2026-09-16':
                board.append(dict(ts=j['ts'], id=j['id'], topic=j.get('topic', ''), cwd=(j.get('from') or {}).get('cwd'),
                                  checkpoint='checkpoint' in (j.get('tags') or []) or 'checkpoint' in (j.get('body') or '').lower()[:40]))
    out = []
    for f in sessions(args.sessions_root):
        S = parse(f)
        if S: out.append(correlate(S, board))
    out.sort(key=lambda r: (-r['nboard'], r['sid']))
    os.makedirs(args.output_dir, exist_ok=True)
    with open(os.path.join(args.output_dir, 'board_corr.json'), 'w') as fh:
        json.dump(out, fh, indent=1)
        fh.write('\n')
    print(f"corpus: {sum(r['nsteer'] for r in out)} user follow-ups; {sum(r['near10m'] for r in out)} within 10m of own checkpoint; {sum(bool(r['nboard']) for r in out)}/{len(out)} sessions with own checkpoint rows")
    print('Signed gaps: event minus knee seconds; null means no matched event in the session lifetime.')
    for r in out:
        knee = r['knees']['context_300k']
        if knee:
            print(r['work'], 'context_300k', knee['timestamp'], 'tool', knee['tool_index'],
                  'steer', knee['nearest_steer'], 'checkpoint', knee['nearest_checkpoint'],
                  'run_checkpoint', knee['nearest_run_checkpoint'])


if __name__ == '__main__':
    main()
