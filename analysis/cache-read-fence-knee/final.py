#!/usr/bin/env python3
"""knee + respawn-from-ticket counterfactual. see report.md for definitions."""
import argparse
import json
import os
import statistics
import sys
sys.dont_write_bytecode = True
from scan import parse, sessions, linfit, sse_res


def seg_cf(x, steer_set, k, n, P0, Cs=None):
    """k is the number of sunk calls; steer_set contains 1-based call indices.

    Each replay call pays P0 plus growth since its fresh segment's first call.
    A missing threshold means no respawn, not a free remaining session.
    """
    if k is None or k >= n:
        return Cs[-1] if Cs else sum(x)
    cf = Cs[k - 1] if Cs is not None and k else 0
    a = k
    bounds = sorted({t - 1 for t in steer_set if k < t - 1 < n}) + [n]
    for b in bounds:
        cf += sum(P0 + max(0, x[j] - x[a]) for j in range(a, b))
        a = b
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
        if cnt >= 3: ks = i - 1; break
    # changepoint on C(i)
    best = None
    for k in range(5, n - 4):
        a1, b1 = linfit(range(1, k + 1), Cs[:k]); a2, b2 = linfit(range(k + 1, n + 1), Cs[k:])
        sse = sse_res(range(1, k + 1), Cs[:k], a1, b1) + sse_res(range(k + 1, n + 1), Cs[k:], a2, b2)
        if best is None or sse < best[1]: best = (k, sse)
    kcp = best[0] if best else None
    # Optimal first reset; subsequent resets occur at steer segment boundaries.
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
            if v >= th: return i + 1
        return None
    kx = {th: kneex(th * 1000) for th in (100, 200, 300)}
    cfx = {th: (seg_cf(x, steer, k, n, P0, Cs)) for th, k in kx.items()}
    return dict(n=n, R=R, cost=sum(c['cost'] for c in calls),
                P0=P0, x1=x[0], xmax=max(x), xlast=x[-1],
                knee_slope2=ks, knee_cp=kcp, knee_star=kk,
                k_ts=calls[kk - 1]['ts'] if kk is not None else None,
                Ck=Cs[kk - 1] if kk is not None else None, xk=x[kk - 1] if kk is not None else None,
                cf=cfk, save=(R - cfk) if cfk is not None else None,
                near_star=near(kk), near_slope=near(ks), near_cp=near(kcp),
                nsteers=len(steer), nmiss=len(misses), kx=kx, cfx=cfx,
                save_x={th: (R - v) if v is not None else None for th, v in cfx.items()},
                miss_w=sum(calls[i]['w'] for i in misses), miss_in=sum(calls[i]['i'] for i in misses),
                ntools=sum(c['tools'] for c in calls))

def tabulate(S):
    """Every billed assistant call, mapped onto the cumulative tool-call axis."""
    curve = []; C = 0; tools = 0
    for i, c in enumerate(S['calls'], 1):
        x = c['i'] + c['s'] + c['w']
        C += c['s']; before = tools; tools += c['tools']
        curve.append(dict(assistant_index=i, tool_index=tools, tool_first=before + 1 if c['tools'] else None,
                          tools=c['tools'], timestamp=c['ts'], cache_read=c['s'], context=x,
                          cumulative_cache_read=C, steer=c['steer'], cache_miss=x > 0 and c['s'] < 0.5*x,
                          cache_write=c['w'], input=c['i']))
    return curve


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sessions-root', default=os.path.expanduser('~/.pi/agent/sessions'))
    parser.add_argument('--output-dir', default=os.path.dirname(os.path.abspath(__file__)))
    parser.add_argument('--estimate-json', help='Estimate {x, P0, k, steer_at, cumulative_reads}; k is sunk call count')
    args = parser.parse_args()
    if args.estimate_json:
        v = json.loads(args.estimate_json)
        k = v.get('k', 0)
        if k is not None and not 0 <= k <= len(v['x']):
            parser.error('k must be a sunk call count between 0 and len(x)')
        if k and len(v.get('cumulative_reads', [])) != len(v['x']):
            parser.error('k > 0 requires cumulative_reads for every original call')
        print(json.dumps({'counterfactual': seg_cf(v['x'], v.get('steer_at', []), k, len(v['x']),
                                                 v['P0'], v.get('cumulative_reads'))}))
        return
    rows = []; curves = {}
    for f in sessions(args.sessions_root):
        S = parse(f)
        if not S: continue
        name = os.path.basename(os.path.dirname(f)).strip('-')
        # SID keys avoid overwriting restarted workers in the same worktree.
        rows.append(dict(name=name, file=f, sid=S['sid'], start=S['start'], end=S['end'], models=S['models'], **analyze(S)))
        curves[S['sid']] = tabulate(S)
    rows.sort(key=lambda r: -r['R'])
    os.makedirs(args.output_dir, exist_ok=True)
    for filename, value in [('sessions.json', rows), ('curves.json', curves)]:
        with open(os.path.join(args.output_dir, filename), 'w') as fh:
            if filename == 'curves.json':
                fh.write('{\n' + ',\n'.join(json.dumps(sid) + ': [\n' + ',\n'.join(json.dumps(p) for p in points) + '\n]'
                                           for sid, points in value.items()) + '\n}')
            else:
                json.dump(value, fh, indent=1)
            fh.write('\n')
    if not rows:
        parser.error('no matching sessions')
    total = sum(r['R'] for r in rows)
    slope = [r['knee_slope2'] for r in rows if r['knee_slope2'] is not None]
    cp = [r['knee_cp']/r['n'] for r in rows if r['knee_cp'] is not None]
    slope_range = f'{min(slope)}–{max(slope)}' if slope else 'none'
    cp_range = f'{min(cp):.3f}–{max(cp):.3f}' if cp else 'none'
    lines = ['# Measured cache-read results', '',
             f"{len(rows)} sessions; R={total:,} cache-read tokens; ${sum(r['cost'] for r in rows):.2f} list-price; median ${statistics.median(r['cost'] for r in rows):.2f}.", '',
             f"Slope-doubling call range: {slope_range} ({len(slope)} non-null; {len(rows)-len(slope)} null). Changepoint fraction: {cp_range}.", '',
             f"Search-floor optima (k=5): {sum(r['knee_star']==5 for r in rows)}/{len(rows)}. Within ±5 assistant calls of a user follow-up: slope {sum(r['near_slope'] is not None for r in rows)}, changepoint {sum(r['near_cp'] is not None for r in rows)}, optimum {sum(r['near_star'] is not None for r in rows)}.", '',
             '| context policy (tokens) | actual | counterfactual | saved | saved / R |',
             '|---|---:|---:|---:|---:|']
    for th in (100, 200, 300):
        cf = sum(r['cfx'][th] for r in rows)
        lines.append(f'| ≥{th*1000:,} | {total:,} | {cf:,.0f} | {total-cf:,.0f} | {(total-cf)/total:.1%} |')
    lines += ['', '## Every session, worst actual cache-read first', '',
              'All quantities below are tokens. k is 1-based assistant call index; `none` means no threshold crossing (actual = counterfactual).', '',
              '| session | actual R | k100 / k200 / k300 | cf100 | cf200 | cf300 | saved300 | optimal k / cf |',
              '|---|---:|---|---:|---:|---:|---:|---|']
    for r in rows:
        work = r['name'].split('__worktrees-')[-1]
        ks = ' / '.join(str(r['kx'][th]) if r['kx'][th] is not None else 'none' for th in (100, 200, 300))
        lines.append(f"| {work} ({r['sid'][:8]}) | {r['R']:,} | {ks} | {r['cfx'][100]:,.0f} | {r['cfx'][200]:,.0f} | {r['cfx'][300]:,.0f} | {r['save_x'][300]:,.0f} | {r['knee_star']} / {r['cf']} |")
    text = '\n'.join(lines) + '\n'
    with open(os.path.join(args.output_dir, 'results.md'), 'w') as fh:
        fh.write(text)
    print(text, end='')
if __name__ == '__main__':
    main()
