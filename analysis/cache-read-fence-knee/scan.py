#!/usr/bin/env python3
"""cumulative cache-read knee + respawn counterfactual over opus worker sessions.
corpus: ~/.pi/agent/sessions, start-date 2026-09-14..16,
model_change.modelId=claude-opus-5, __worktrees cwd.
User follow-ups after the first prompt are steer proxies, mapped to the next
assistant usage record. Estimation and curves live in final.py.
"""
import json, os, glob, sys

ROOT = os.path.expanduser('~/.pi/agent/sessions')
DATES = ('2026-09-14', '2026-09-15', '2026-09-16')
MODEL = 'claude-opus-5'

def sessions(root=ROOT):
    for d in sorted(glob.glob(root + '/*/')):
        for f in sorted(glob.glob(d + '*.jsonl')):
            if os.path.basename(f)[:10] in DATES:
                yield f

def parse(f):
    cwd = None; models = []; calls = []; steers = []; first_user_seen = False
    start = None; end = None; sid = None
    try:
        fh = open(f, errors='replace')
    except OSError:
        return None
    with fh:
        for line in fh:
            try:
                j = json.loads(line)
            except Exception:
                continue
            t = j.get('type')
            if t == 'session':
                cwd = j.get('cwd'); sid = j.get('id'); start = j.get('timestamp')
            elif t == 'model_change':
                models.append(j.get('modelId'))
            elif t == 'message':
                m = j.get('message') or {}
                role = m.get('role'); ts = j.get('timestamp')
                end = ts
                if role == 'assistant' and m.get('usage'):
                    u = m['usage']
                    tools = sum(1 for c in (m.get('content') or []) if isinstance(c, dict) and c.get('type') in ('toolCall', 'toolUse', 'tool_call', 'tool_use'))
                    calls.append(dict(ts=ts, s=u.get('cacheRead', 0), i=u.get('input', 0), o=u.get('output', 0),
                                      w=u.get('cacheWrite', 0), r=u.get('reasoning', 0),
                                      cost=(u.get('cost') or {}).get('total', 0), tools=tools,
                                      steer=False))
                elif role == 'user':
                    texts = [c.get('text', '') for c in (m.get('content') or []) if isinstance(c, dict) and c.get('type') == 'text']
                    if texts and any(t_.strip() for t_ in texts):
                        if first_user_seen:
                            steers.append(dict(ts=ts, chars=sum(len(t_) for t_ in texts), head=texts[0][:90].replace('\n', ' ')))
                        first_user_seen = True
    if not calls or cwd is None:
        return None
    if not any(m == MODEL for m in models):
        return None
    if '__worktrees' not in cwd:
        return None
    # attribute steers to next assistant call index (1-based)
    # rewalk cheaply: we lost order; rebuild by timestamp merge
    events = [(c['ts'], 'c') for c in calls] + [(s['ts'], 's') for s in steers]
    events.sort(key=lambda e: (e[0] or ''))
    ncall = 0
    steer_at = []
    for ts, kind in events:
        if kind == 'c':
            ncall += 1
        else:
            steer_at.append(ncall + 1)
    for idx in steer_at:
        if 1 <= idx <= len(calls):
            calls[idx - 1]['steer'] = True
    return dict(sid=sid, file=f, cwd=cwd, models=models, start=start, end=end,
                calls=calls, steers=steers, steer_at=steer_at)


def linfit(xs, ys):
    n = len(xs); sx = sum(xs); sy = sum(ys); sxx = sum(v * v for v in xs); sxy = sum(a * b for a, b in zip(xs, ys))
    d = n * sxx - sx * sx
    if d == 0: return 0.0, sy / n if n else 0
    a = (n * sxy - sx * sy) / d
    return a, (sy - a * sx) / n

def sse_res(xs, ys, a, b):
    return sum((y - (a * t + b)) ** 2 for t, y in zip(xs, ys))

if __name__ == '__main__':
    # Keep the original entry point on the same model as the published report.
    sys.dont_write_bytecode = True
    from final import main
    main()
