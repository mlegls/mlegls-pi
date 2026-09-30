#!/usr/bin/env python3
"""knee + respawn-from-ticket counterfactual. see report.md for definitions."""
import json, os, statistics, sys, glob
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(__file__))
from scan import parse, sessions, linfit, sse_res, ROOT

def iso(ts):
    return ts if ts else None

def seg_cf(x, steer_set, k, n, P0, Cs=None):
    """post-knee work replayed in fresh sessions; segments delimited by steers.
    segment [a..b] pays (b-a+1)*P0 + (x_b - x_a)."""
    if k is None or k >= n - 2: return None
    cf = (Cs[k] if Cs is not None else 0); a = k + 1
    bounds = sorted(t for t in steer_set if k + 2 <= t <= n)
    for b in bounds:
        if b > a:
            cf += (b - a) * P0 + max(0, x[b - 1] - x[a - 1]); a = b
    if n >= a:
        cf += (n - a + 1) * P0 + max(0, x[n - 1] - x[a - 1])
    return cf

def analyze(S):
    calls = S['calls']; n = len(calls)
    x = [c['i'] + c['s'] + c['w'] for c in calls]
    s = [c['s'] for c in calls]
    R = sum(s)
    Cs = []; C = 0
    for v in s: C += v; Cs.append(C)
    steer = set(S['steer_at'])
    P0 = statistics.median(s[:5]) or s[0] or 1
    warm = statistics.median(s[5:11]) if n >= 11 else P0
    # knee_slope2: first i>=7 with s_i >= 2*warm sustained 3
    ks = None; cnt = 0
    for i in range(7, n):
        cnt = cnt + 1 if s[i] >= 2 * warm else 0
        if cnt >= 3: ks = i - 2; break
    # changepoint on C(i)
    best = None
    for k in range(5, n - 4):
        a1, b1 = linfit(range(1, k + 1), Cs[:k]); a2, b2 = linfit(range(k + 1, n + 1), Cs[k:])
        sse = sse_res(range(1, k + 1), Cs[:k], a1, b1) + sse_res(range(k + 1, n + 1), Cs[k:], a2, b2)
        if best is None or sse < best[1]: best = (k, sse)
    kcp = best[0] if best else None
    # optimal single respawn (segmented cf)
    kk = None; cfk = None
    for k in range(5, n - 5):
        cf = seg_cf(x, steer, k, n, P0, Cs)
        if cf is not None and (cfk is None or R - cf > R - cfk): kk, cfk = k, cf
    def near(k, win=5):
        if k is None: return None
        d = min((abs(k - t) for t in steer), default=None)
        return d if d is not None and d <= win else None
    misses = [i for i in range(n) if x[i] > 0 and s[i] < 0.5 * x[i]]
    def kneex(th):
        for i, v in enumerate(x):
            if v >= th: return i
        return None
    kx = {th: kneex(th * 1000) for th in (100, 200, 300)}
    cfx = {th: (seg_cf(x, steer, k, n, P0, Cs)) for th, k in kx.items()}
    return dict(n=n, R=R, cost=sum(c['cost'] for c in calls),
                P0=P0, x1=x[0], xmax=max(x), xlast=x[-1],
                knee_slope2=ks, knee_cp=kcp, knee_star=kk,
                k_ts=calls[kk]['ts'] if kk is not None else None,
                Ck=Cs[kk] if kk is not None else None, xk=x[kk] if kk is not None else None,
                cf=cfk, save=(R - cfk) if cfk is not None else None,
                near_star=near(kk), near_slope=near(ks), near_cp=near(kcp),
                nsteers=len(steer), nmiss=len(misses), kx=kx, cfx=cfx,
                save_x={th: (R - v) if v is not None else None for th, v in cfx.items()},
                miss_w=sum(calls[i]['w'] for i in misses), miss_in=sum(calls[i]['i'] for i in misses),
                ntools=sum(c['tools'] for c in calls))

def main():
    rows = []; curves = {}
    for f in sessions():
        S = parse(f)
        if not S: continue
        A = analyze(S)
        name = os.path.basename(os.path.dirname(f)).strip('-')
        rows.append(dict(name=name, file=f, sid=S['sid'], start=S['start'], end=S['end'], models=S['models'], **A))
        calls = S['calls']; x = [c['i'] + c['s'] + c['w'] for c in calls]; C = 0
        curve = []
        for i, (c, xi) in enumerate(zip(calls, x), 1):
            C += c['s']
            if i <= 3 or i % 10 == 0 or c['steer'] or i == len(calls) or (xi > 0 and c['s'] < 0.5 * xi) or i in (A['knee_star'], A['knee_slope2'], A['knee_cp']):
                curve.append([i, c['s'], xi, C, int(c['steer']), int(xi > 0 and c['s'] < 0.5 * xi)])
        curves[name] = curve
    rows.sort(key=lambda r: -(r['save'] or 0))
    here = os.path.dirname(os.path.abspath(__file__))
    json.dump(rows, open(here + '/sessions.json', 'w'), indent=1)
    json.dump(curves, open(here + '/curves.json', 'w'))
    R_all = sum(r['R'] for r in rows); S_all = sum(r['save'] or 0 for r in rows)
    ns = sum(1 for r in rows if r['near_star'] is not None)
    print(f'n={len(rows)} R_all={R_all:,} save_all={S_all:,} ({S_all/R_all:.1%})')
    print(f'knee* within 5 calls of a steer: {ns}/{len(rows)}; slope-knee near steer: {sum(1 for r in rows if r["near_slope"] is not None)}/{len(rows)}; cp near steer: {sum(1 for r in rows if r["near_cp"] is not None)}/{len(rows)}')
    print(f'knee*/n median={statistics.median(r["knee_star"]/r["n"] for r in rows):.2f} x@knee/xmax median={statistics.median(r["xk"]/r["xmax"] for r in rows):.2f}')
    hdr = f'{"session":46} {"n":>4} {"R":>12} {"k*":>4} {"x@k*":>9} {"save":>12} {"%R":>5} {"steer~":>6} {"miss":>4} {"$":>7}'
    print(hdr)
    for r in rows[:18]:
        k3 = r["kx"][300]
        print(f'{r["name"][22:68]:46} {r["n"]:4} {r["R"]:>12,} k300={k3} save300={(r["save_x"][300] or 0):>12,} {str(r["save_x"][300] and r["save_x"][300]/r["R"])[:5]:>5} {str(r["near_slope"]):>5} {r["nmiss"]:4} {r["cost"]:7.2f}')
    print(f'policy knees: x>=100k save={sum(r["save_x"][100] or 0 for r in rows):,} ({sum(r["save_x"][100] or 0 for r in rows)/R_all:.0%}) | x>=200k save={sum(r["save_x"][200] or 0 for r in rows):,} ({sum(r["save_x"][200] or 0 for r in rows)/R_all:.0%}) | x>=300k save={sum(r["save_x"][300] or 0 for r in rows):,} ({sum(r["save_x"][300] or 0 for r in rows)/R_all:.0%})')
    print(f'TTL misses: n={sum(r['nmiss'] for r in rows)} cacheWrite re-pay mass={sum(r['miss_w'] for r in rows):,} input mass={sum(r['miss_in'] for r in rows):,}')
    print('...'); 
    for r in rows[-4:]:
        print(f'{r["name"][22:68]:46} {r["n"]:4} {r["R"]:>12,} {r["knee_star"]:4} {r["xk"]:>9,} {r["save"]:>12,} {r["save"]/r["R"]:5.1%} {str(r["near_star"]):>6} {r["nmiss"]:4} {r["cost"]:7.2f}')

if __name__ == '__main__':
    main()
