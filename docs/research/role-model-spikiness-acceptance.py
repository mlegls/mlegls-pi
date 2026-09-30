"""Acceptance ledger for docs/research/role-model-spikiness-2026-09-30.md.

  python3 docs/research/role-model-spikiness-acceptance.py     (after role-model-spikiness.py)

Reads attachments/role-model-spikiness/ledger.json and the board log
(~/.local/share/pi-board/log.jsonl) and writes attachments/role-model-spikiness/acceptance.json:

- `review`: one row per review worker of the 09-15/16 factor-finish campaign (the matched family
  plus the silent/guard rounds), keyed by session id. Each row joins the worker's board report to the
  parent's next action. Report and parent ids are curated below from reading the reports and the
  parent sessions; timestamps, latency and wall time are computed from the board log and ledger.
  `parent_session_line` cites the JSONL line of the parent tool call (finish-materials parent
  `--Users-mlegls-dev-mmon-concept__worktrees-finish-materials--/2026-09-15T09-58-17-318Z_01a0a480-c3e5-7560-b963-074f78725602.jsonl`).
- `verify`: every verify-story session with the tags of the board messages its own handle sent
  during the run.
"""
import datetime as dt, json
from pathlib import Path

ATT = Path(__file__).resolve().parent.parent / 'attachments/role-model-spikiness'
BOARD = Path.home() / '.local/share/pi-board/log.jsonl'
PARENT = '--Users-mlegls-dev-mmon-concept__worktrees-finish-materials--/2026-09-15T09-58-17-318Z_01a0a480-c3e5-7560-b963-074f78725602.jsonl'


def T(s): return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))


# (handle, model, report id, parent board id, disposition, parent_session_line, note)
REVIEWS = [
    ('u1-security-review', 'glm', 'mu2jv6in-rol45c', 'mu2jvha0-7j30it', 'repair-required',
     None, 'parent: fix emit_quiz text-envelope reconstruction and doc before acceptance; independent rereview + runtime'),
    ('u1-rereview', 'glm', 'mu2lr490-7bmh28', 'mu2lracj-y8f8tv', 'cleared-merged', 514,
     'parent: delta rereview clear, proceed; merge u1-transcript-cutover at 11:49:16. Parent also overrides reviewer claim "ai needs no patch" (ai@7.0.99 provenance patch)'),
    ('u2-review', 'glm', 'mu2mpq98-el9ybh', 'mu2mpwym-op17ke', 'blocker-repaired', 601,
     'parent: repair Review outer replay then rereview; spawns u2-review-replay, closes u2-review --keep-branch'),
    ('u2-replay-rereview', 'glm', 'mu2nm46u-wpiiol', 'mu2nmaik-khb11g', 'blocker-repaired', 775,
     'parent: persist raw selfGrade; spawns u2-selfgrade-persist, closes u2-replay-rereview --keep-branch'),
    ('u1-error-rereview', 'glm', 'mu2ony02-rzavej', 'mu2oo6hd-okb05y', 'cleared-with-repair', 809,
     'parent: source clear, apply bounded projection nits first; spawns u1-error-metadata-omit'),
    ('u1-error-delta-review', 'glm', 'mu2p9o96-h7ccph', 'mu2p9wzj-p92xqn', 'cleared-merged', 847,
     'parent: delta clear, proceed to runtime; rejects one reviewer nit (pre-map filter); merges u1-error-metadata-omit 13:21:15'),
    ('cursor-guard-review', 'glm', 'mu2mh1h7-gy0idx', 'mu2mh80v-uqvkwe', 'cleared-merged', 556,
     'parent: clear, integrate guard; rejects one reviewer nit (cursor dedupe); merges u1-cursor-guard 12:03:08'),
    ('guard-review', 'glm', 'mu2rx0dc-ag3ef1', 'mu2rxahp-onjs4z', 'cleared-claim-overridden', None,
     'parent: clear, but reviewer fact "Hub tags only theory constants" appears false; orders H5 fact check'),
    ('guard-review-2', 'glm', None, None, 'silent-provider-error', None,
     'stopReason error at turn 11, no report; guard-review-3 session started 75 s after the last message'),
    ('guard-review-3', 'glm', 'mu2tcsk4-galino', 'mu2td20h-b466dn', 'cleared', None,
     'parent: clears bounded links+alert source'),
    ('u2-selfgrade-rereview', 'glm', None, None, 'silent-provider-error', 1000,
     'stopReason error at turn 4, no report. Parent wrote "waiting on u2-selfgrade-rereview" at 13:05, 13:10, 13:21, 13:22 (lines 811-855); noticed "exited without posting a report" at 16:13:38 (line 995); respawned 16:14:41'),
    ('u2-selfgrade-rereview', 'deepseek', 'mu2vq8lf-p0wol8', 'mu2vqg7i-lstqm4', 'cleared', None,
     'parent: final source clear, join then main integration approved'),
    ('u3-review', 'astra', 'mu2wc6lz-0iwtnj', 'mu2wccmk-zzjszm', 'clear-not-accepted', None,
     'reviewer: no blocking findings. parent: needs-input, holds U3 acceptance (tutor surface.close bypasses completion); '
     'materials-closeout later repairs "requireCompletion on tutor surface.close" (mu3ij90b-p1elxc, 29184790)'),
    ('u4-review', 'astra', 'mu2woxlv-m9l22w', 'mu2wp7xw-um2mc4', 'blocker-repaired', None,
     'parent: keep U4 frozen, accept only the joined U4/U5 repair; repaired inside U5 (mu2xec6j-eyyt6j); joined approved mu2xen27-ijohmn'),
    ('u5-review', 'astra', 'mu2xectc-8cfsg5', 'mu2xen27-ijohmn', 'cleared', None,
     'parent: source clear, join U4/U5 approved'),
    ('u6-review', 'astra', None, None, 'silent-no-report', None,
     'session ended normally at 17:06:39 with no board send; u6-review-2 session started 17:07:15'),
    ('u6-review-2', 'astra', 'mu2xe4wc-ybdpgd', 'mu2xeapa-xq6j6d', 'cleared-with-repair', None,
     'parent: static clear, but a requested same-attempt requirement was not answered; bounded UX fix before browser drive'),
    ('fixture-rereview', 'astra', 'mu3gyajz-ykapbt', 'mu3ij90b-p1elxc', 'cleared-merged', None,
     'reviewer: ACCEPT 9e772a0; that commit is in the materials-closeout merge-ready report mu3ij90b-p1elxc (79e59f7d)'),
]


def main():
    led = json.load(open(ATT / 'ledger.json'))
    board = {}
    msgs = []
    for i, l in enumerate(open(BOARD), 1):
        o = json.loads(l); o['_line'] = i
        board[o['id']] = o; msgs.append(o)
    out = {'parent_session': PARENT, 'review': [], 'verify': []}
    for handle, model, rid, pid, disp, line, note in REVIEWS:
        s = next(r for r in led if r['handle'] == handle and r['model'] == model)
        row = dict(handle=handle, model=model, session=s['session'], cost=s['cost'], turns=s['turns'],
                   start=s['start'], last_message=s['last_message'], last_stop=s['last_stop'],
                   report_id=rid, parent_id=pid, disposition=disp, parent_session_line=line, note=note)
        if rid:
            r = board[rid]; row['report_ts'] = r['ts']; row['report_board_line'] = r['_line']
            row['wall_min'] = round((T(r['ts']) - T(s['start'])).total_seconds() / 60, 1)
        if pid:
            p = board[pid]; row['parent_ts'] = p['ts']; row['parent_board_line'] = p['_line']
            if rid: row['parent_latency_s'] = round((T(p['ts']) - T(board[rid]['ts'])).total_seconds())
        out['review'].append(row)
    for s in led:
        if s['shape'] != 'verify-story': continue
        lo, hi = T(s['start']), T(s['last_message']) + dt.timedelta(minutes=2)
        mine = [(o['id'], o['ts'], o['tags'][:3]) for o in msgs
                if (o.get('from') if isinstance(o.get('from'), str) else (o.get('from') or {}).get('name')) == s['handle']
                and lo <= T(o['ts']) <= hi]
        out['verify'].append(dict(handle=s['handle'], model=s['model'], session=s['session'], cost=s['cost'],
                                  turns=s['turns'], excluded=s['excluded'], own_board_messages=mine))
    (ATT / 'acceptance.json').write_text(json.dumps(out, indent=1) + '\n')
    for r in out['review']:
        print(f"{r['handle']:24}{r['model']:9}{r['disposition']:26} wall {r.get('wall_min','-')!s:>6} min  parent +{r.get('parent_latency_s','-')}s  ${r['cost']:.3f}")


main()
