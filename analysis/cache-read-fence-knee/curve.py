import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scan import parse
f = sys.argv[1]
S = parse(f)
if not S: print("no match"); sys.exit()
calls = S['calls']; steer = set(S['steer_at'])
x = [c['i']+c['s']+c['w'] for c in calls]; C=0
print("idx      s_read       x_ctx     cum_C   ampl  steer tools")
for i,(c,xi) in enumerate(zip(calls,x),1):
    C += c['s']
    if i<=12 or i%25==0 or c['steer'] or i==len(calls) or (xi>0 and c['s']>1.6*xi):
        print(f"{i:4} {c['s']:>11,} {xi:>12,} {C:>13,} {c['s']/max(xi,1):5.2f}  {'S' if i in steer else ' '} {c['tools']:>4}  {c['ts'][:16] if c['ts'] else ''}")
print("steers at:", S['steer_at'][:40], "chars:", [s['chars'] for s in S['steers']][:20])
