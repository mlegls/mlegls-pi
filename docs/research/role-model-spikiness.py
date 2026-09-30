"""Ledger and tables for docs/research/role-model-spikiness-2026-09-30.md.

  python3 docs/research/role-model-spikiness.py [--sessions DIR] [--out FILE]

Walks every session file dated 2026-09-01..09-22 under ~/.pi/agent/sessions, keeps
those whose first user message starts with the review or verify-story worker prompt,
and writes one ledger row per session (default:
docs/attachments/role-model-spikiness/ledger.json). Model is the `model` on the
session's assistant messages (a `mixed` model lists all); cost is the sum of
assistant `usage.cost.total`; turns = assistant messages; tool calls = toolCall
content blocks. Prints the per-role tables and the first-round pair ratios.
"""
import argparse, collections as C, glob, json, os, statistics as S, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path.home() / '.pi/agent/sessions'
LO, HI = '2026-09-01', '2026-09-22'
SHAPES = [  # (shape, first-user-message prefix); both review wordings are the same stance
    ('review', "review the diff you're pointed at"),
    ('verify-story', '`verify-story` on what you\'re given. you\'re the persona'),
]
SMOKE_TURNS = 5  # fewer assistant messages = smoke/one-liner, not a task attempt
# Excluded from completed-attempt medians (still in the ledger and the n): the last assistant
# message ended on a provider error (stopReason 'error'), or the session is a smoke test.


def family(model):
    for key, name in [('glm', 'glm'), ('astra', 'astra'), ('deepseek', 'deepseek'), ('sonnet', 'sonnet'),
                      ('opus', 'opus'), ('terra', 'terra')]:
        if key in model:
            return name
    return model


def read(path):
    first, models, cost, turns, calls, stop = None, C.Counter(), 0.0, 0, 0, None
    t0 = t1 = None
    tok = C.Counter()
    for line in open(path, errors='replace'):
        try:
            o = json.loads(line)
        except ValueError:
            continue
        m = o.get('message') or {}
        t0 = t0 or o.get('timestamp')
        if o.get('type') != 'message':
            continue
        t1 = o.get('timestamp')  # last message record
        if m.get('role') == 'user' and first is None:
            c = m.get('content')
            first = ' '.join(x.get('text', '') for x in c if isinstance(x, dict)) if isinstance(c, list) else c
        elif m.get('role') == 'assistant':
            turns += 1
            stop = m.get('stopReason')
            models[family(m.get('model') or '?')] += 1
            u = m.get('usage') or {}
            cost += (u.get('cost') or {}).get('total', 0)
            for k in ('input', 'output', 'cacheRead', 'cacheWrite'):
                tok[k] += u.get(k, 0)
            calls += sum(1 for b in (m.get('content') or []) if isinstance(b, dict) and b.get('type') == 'toolCall')
    return first or '', models, cost, turns, calls, dict(tok), stop, t0, t1


def build(root):
    rows = []
    for f in sorted(glob.glob(str(root / '*/2026-09-*.jsonl'))):
        base = os.path.basename(f)
        if not (LO <= base[:10] <= HI):
            continue
        first, models, cost, turns, calls, tok, stop, t0, t1 = read(f)
        shape = next((s for s, p in SHAPES if first.startswith(p)), None)
        if not shape:
            continue
        cwd = os.path.basename(os.path.dirname(f))
        rows.append(dict(
            session=base.split('_', 1)[1][:-6], file=f'{cwd}/{base}',
            handle=cwd.split('__worktrees-')[-1].strip('-'), shape=shape,
            model='/'.join(sorted(models)) if len(models) < 2 else 'mixed:' + '/'.join(sorted(models)),
            cost=round(cost, 9), turns=turns, tool_calls=calls, tokens=tok,
            start=t0, last_message=t1, last_stop=stop,
            excluded=('provider error' if stop == 'error' else 'smoke' if turns < SMOKE_TURNS else None)))
    return rows


def med(xs):
    return S.median(xs) if xs else None


def tables(rows):
    out = ['shape, model | n (excluded) | cost med [min..max] | turns med [range] | tool calls med | cacheRead med']
    g = C.defaultdict(list)
    for r in rows:
        g[(r['shape'], r['model'])].append(r)
    for (shape, model), rs in sorted(g.items()):
        ok = [r for r in rs if not r['excluded']]
        if not ok:
            out.append(f'{shape}, {model} | {len(rs)} ({len(rs)}) | -'); continue
        c = [r['cost'] for r in ok]; t = [r['turns'] for r in ok]
        out.append(f"{shape}, {model} | {len(rs)} ({len(rs) - len(ok)}) | {med(c):.3f} [{min(c):.3f}..{max(c):.3f}]"
                   f" | {med(t):g} [{min(t)}..{max(t)}] | {med(r['tool_calls'] for r in ok):g}"
                   f" | {med(r['tokens']['cacheRead'] for r in ok):,.0f}")
    return out


# 09-15 factor-finish first-round unit reviews: handle -> session id fixed by handle+model
GLM_FIRST = ['u1-security-review', 'u2-review']
ASTRA_FIRST = ['u3-review', 'u4-review', 'u5-review', 'u6-review']


def ratios(rows):
    by = {(r['handle'], r['model']): r for r in rows if r['handle'] in GLM_FIRST + ASTRA_FIRST}
    a = [by[(h, 'astra')]['cost'] for h in ASTRA_FIRST]
    g = [by[(h, 'glm')]['cost'] for h in GLM_FIRST]
    rs = sorted(x / y for x in a for y in g)
    return rs, S.median(a) / S.median(g)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--sessions', default=str(ROOT))
    ap.add_argument('--out', default=str(HERE.parent / 'attachments/role-model-spikiness/ledger.json'))
    a = ap.parse_args()
    rows = build(Path(a.sessions))
    Path(a.out).write_text(json.dumps(rows, indent=1) + '\n')
    print('\n'.join(tables(rows)))
    rs, gm = ratios(rows)
    print('first-round astra/glm pair ratios:', ' '.join(f'{x:.2f}' for x in rs))
    print(f'median pair ratio {S.median(rs):.2f}; ratio of group medians {gm:.2f}', file=sys.stdout)
