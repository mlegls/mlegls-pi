#!/usr/bin/env python3
"""cumulative cache-read knee + respawn counterfactual over opus worker sessions.
corpus: ~/.pi/agent/sessions, start-date 2026-09-14..16, model_change.modelId=claude-opus-5, __worktrees cwd.
x_i = input+cacheRead+cacheWrite (context at call i). s_i = cacheRead (prefix re-read payment).
m0 = median s_i over first 10 calls (fresh-prefix marginal).
knee2: first i with s_i > 2*m0 sustained 3 calls. knee4: same at 4x.
kneecp: two-segment least-squares changepoint on C(i).
counterfactual(k): C_k + sum_{j>k} x'_j, x'_j = P0 + max(0, x_j - x_k), P0=m0.
steer: user text message after session's first user text; attributed to next assistant call.
"""
import json, os, glob, statistics, sys
from datetime import datetime, timezone

ROOT = os.path.expanduser('~/.pi/agent/sessions')
DATES = ('2026-09-14', '2026-09-15', '2026-09-16')
MODEL = 'claude-opus-5'

def sessions():
    for d in sorted(glob.glob(ROOT + '/*/')):
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
            if '"claude-opus-5"' not in line and '"message"' not in line and '"session"' not in line:
                pass
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
    ci = 0; si = 0
    steer_idx = []
    # rewalk cheaply: we lost order; rebuild by timestamp merge
    events = [(c['ts'], 'c') for c in calls] + [(s['ts'], 's') for s in steers]
    events.sort(key=lambda e: (e[0] or ''))
    ncall = 0
    steer_at = []
    for ts, kind in events:
        if kind == 'c':
            ncall += 1
        else:
            steer_at.append(ncall + 1)  # next call pays
    for idx in steer_at:
        if 1 <= idx <= len(calls):
            calls[idx - 1]['steer'] = True
    return dict(sid=sid, file=f, cwd=cwd, models=models, start=start, end=end,
                calls=calls, steers=steers, steer_at=steer_at)

def analyze(S):
    calls = S['calls']
    n = len(calls)
    x = [c['i'] + c['s'] + c['w'] for c in calls]
    s = [c['s'] for c in calls]
    R = sum(s); C = 0; Cs = []
    for v in s:
        C += v; Cs.append(C)
    m0 = statistics.median(s[:10]) if n >= 3 else s[0]

    def knee_mult(k):
        cnt = 0
        for i, v in enumerate(s):
            cnt = cnt + 1 if v > k * m0 else 0
            if cnt >= 3:
                return i - 2
        return None

    knee2 = knee_mult(2); knee4 = knee_mult(4)
    # two-segment changepoint on C(i), i=1..n
    best = None
    for k in range(5, n - 4):
        a1, b1 = linfit(range(1, k + 1), Cs[:k])
        a2, b2 = linfit(range(k + 1, n + 1), Cs[k:])
        sse = sse_res(range(1, k + 1), Cs[:k], a1, b1) + sse_res(range(k + 1, n + 1), Cs[k:], a2, b2)
        if best is None or sse < best[1]:
            best = (k, sse, (a2 - a1))
    kneecp = best[0] if best else None
    cpslope = best[2] if best else None

    def counterfactual(k):
        if k is None or k >= n - 1: return None
        xk = x[k]; P0 = m0
        cf = Cs[k]
        for j in range(k, n):
            cf += P0 + max(0, x[j] - xk)
        return cf

    cf2 = counterfactual(knee2); cfc = counterfactual(kneecp)
    steer_set = set(S['steer_at'])
    def near_steer(k, win=5):
        if k is None: return None
        return any(abs(k - t) <= win for t in steer_set)
    return dict(n=n, R=R, cost=sum(c['cost'] for c in calls),
                x1=x[0], xlast=x[-1], m0=m0,
                knee2=knee2, knee2_ts=calls[knee2]['ts'] if knee2 is not None else None,
                knee4=knee4, kneecp=kneecp, cpslope=cpslope,
                Ck2=Cs[knee2] if knee2 is not None else None,
                Ckcp=Cs[kneecp] if kneecp is not None else None,
                cf2=cf2, cfc=cfc, Rcf_savings2=(R - cf2) if cf2 else None,
                Rcf_savingscp=(R - cfc) if cfc else None,
                near_steer2=near_steer(knee2), near_steer_cp=near_steer(kneecp),
                nsteers=len(S['steers']))

def linfit(xs, ys):
    n = len(xs); sx = sum(xs); sy = sum(ys); sxx = sum(v * v for v in xs); sxy = sum(a * b for a, b in zip(xs, ys))
    d = n * sxx - sx * sx
    if d == 0: return 0.0, sy / n if n else 0
    a = (n * sxy - sx * sy) / d
    return a, (sy - a * sx) / n

def sse_res(xs, ys, a, b):
    return sum((y - (a * t + b)) ** 2 for t, y in zip(xs, ys))

def main():
    out = []
    for f in sessions():
        S = parse(f)
        if S: out.append(S)
    total = 0
    rows = []
    for S in out:
        A = analyze(S)
        name = os.path.basename(os.path.dirname(S['file'])).strip('-').replace('--private-', '')
        rows.append(dict(name=name, file=S['file'], sid=S['sid'], cwd=S['cwd'], start=S['start'], end=S['end'],
                         models=S['models'], **A))
        total += 1
    rows.sort(key=lambda r: -(r['Rcf_savings2'] or 0))
    json.dump(rows, open(os.path.join(os.path.dirname(__file__), 'sessions.json'), 'w'), indent=1)
    print(f'sessions={total} R_total={sum(r["R"] for r in rows):,} cost_total={sum(r["cost"] for r in rows):.2f}')
    for r in rows[:15]:
        print(f'{r["name"][:52]:52} n={r["n"]:4} R={r["R"]:>12,} m0={r["m0"]:>8,.0f} knee2={r["knee2"]} cf_save={r["Rcf_savings2"] or 0:>12,} steer@{r["nsteers"]:3} near2={r["near_steer2"]} cost=${r["cost"]:.2f}')

if __name__ == '__main__':
    main()
