#!/usr/bin/env python3
"""Per-run metrics for the orchestrate-rework-effect audit.

Question: did the 09-15 orchestrate rework (system-config a7f7a98, "Route
routine work explicitly and reclassify at phase boundaries") change how runs
behave? Baseline = board-era runs starting 09-14..09-15; after = 09-16..09-21
(the board era ends at the 09-22 scope line; zero sends on 09-17 and 09-22).

run = board topic prefix (hand-curated from the observed topic set, RUNS below).
worker = sender whose from.cwd contains "__worktrees/"; handle = cwd basename.
board parent = any other non-null, non-temp cwd that posts on the board (a
coordinator that never posts is invisible here). Nested topic = depth >= 2
under the matched topic prefix.

Dispatchers (the ticket's "handle count"): for each worker handle, the cwd of
the session whose spawn tool call (wm tool op=spawn, wm_spawn, exec
wm.spawn({... handle ...}), or `wm[.ts] spawn <handle>` in bash) is the latest
one before the handle's first board send, excluding the handle's own
worktree. root dispatchers = such cwds outside __worktrees; worktree
dispatchers = worker worktrees that dispatched workers (nesting). Handles with
no matching spawn call in the local session archive are counted unresolved.

Cost: per-message usage.cost.total joined via board from.session -> session
file ~/.pi/agent/sessions/<encoded-cwd>/<ts>_<uuid>.jsonl. A parent session
that drove several runs contributes its whole-session cost to each (era
totals deduplicate by session). Costs are pi list-price estimates.

Reproduction check (bottom): the 2026-09-18 audit's board aggregates
(217 worker topics / 201 done / 16 never / 33 checkpointed / 9 >=2x /
452 decision / 34 ack over the same log through 09-16).
"""
import json, os, re, collections, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TSV = os.path.join(HERE, "metrics.tsv")

LOG = os.path.expanduser("~/.local/share/pi-board/log.jsonl")
SESSIONS = os.path.expanduser("~/.pi/agent/sessions")
W0, W1 = "2026-09-14", "2026-09-22"          # board sends window
REWORK = "2026-09-15T03:33"                  # a7f7a98, +0800 -> UTC

RUNS = [  # (topic prefix, run name); first match wins
    ("orch/exec-frictions-0916", "orch/exec-frictions-0916"),
    ("concept/factor-finish", "concept/factor-finish"),
    ("concept/hook-snapshots-0914", "concept/hook-snapshots-0914"),
    ("concept/transcript-capture-feasibility", "concept/transcript-capture-feasibility"),
    ("concept/browser-flattening", "concept/browser-flattening"),
    ("concept/backend-finish", "concept/backend-finish"),
    ("concept/test-pruning-0914", "concept/test-pruning-0914"),
    ("concept/ui-polish", "concept/ui-polish"),
    ("materials-closeout", "materials-closeout"),
    ("concept/materials-closeout", "materials-closeout"),
    ("review/board-freshness-70188ae", "review/board-freshness"),
    ("experiment/compression", "experiment/compression"),
    ("experiment/compression-real", "experiment/compression"),
    ("verify-final-1789475876420", "verify-final"),
    ("verify-final-1789475928277", "verify-final"),
    ("verify-final-1789475939416", "verify-final"),
    ("verify-final", "verify-final"),
    ("orch/forum-search", "orch/forum-search"),
    ("orch/dev-chat", "orch/dev-chat"),
    ("fix/board-delivery", "fix/board-delivery"),
    ("audit/pi-routing-20260915", "audit/pi-routing"),
    ("orch/exec-runtime-core", "orch/exec-runtime-core"),
    ("orch/exec-presentation", "orch/exec-presentation"),
    ("orch/exec-next", "orch/exec-next"),
    ("orch/exec-kernel", "orch/exec-kernel"),
    ("orch/exec-frictions", "orch/exec-frictions"),
    ("orch/exec-expand", "orch/exec-expand"),
    ("orch/model-175", "orch/model-175"),
    ("cm-frontier", "cm-frontier"),
    ("exec-state/test-migration", "exec-state/test-migration"),
    ("frontier/0919", "frontier/0919"),
    ("reorg/0918", "reorg/0918"),
    ("vault/mlegls-pi", "vault/mlegls-pi"),
    ("orca-probe", "orca-probe"),
]
AFTER_RUNS = {"cm-frontier", "materials-closeout", "exec-state/test-migration",
              "orch/exec-frictions-0916", "concept/ui-polish", "frontier/0919",
              "reorg/0918", "vault/mlegls-pi", "orca-probe"}

def match(topic):
    for pref, run in RUNS:
        if topic == pref or topic.startswith(pref + "/"):
            return pref, run
    return None, None

def run_of(topic):
    return match(topic)[1]

def handle_of(cwd):
    if cwd and "__worktrees/" in cwd:
        return cwd.rsplit("/", 1)[-1]
    return None

def role_of(cwd):
    if not cwd: return "null"
    if "__worktrees/" in cwd: return "worker"
    if "/tmp/" in cwd or cwd.startswith(("/private/tmp/", "/var/folders/", "/private/var/folders/")):
        return "tmp"
    return "parent"

msgs = []
unassigned = 0
with open(LOG) as f:
    for line in f:
        try: m = json.loads(line)
        except json.JSONDecodeError: continue
        if not (W0 <= m.get("ts", "")[:10] < W1): continue
        pref, run = match(m.get("topic", ""))
        if run is None: unassigned += 1; continue
        msgs.append((run, pref, m))
print(f"# board sends {W0}..{W1}: {len(msgs)} (unassigned topics: {unassigned})", file=sys.stderr)

R = {}
first_send = collections.defaultdict(dict)   # run -> handle -> first ts
for run, pref, m in msgs:
    r = R.setdefault(run, dict(sends=0, first=m["ts"], last=m["ts"],
        handles=set(), done_handles=set(), ckpt_handles=collections.Counter(),
        checkpoints=0, decisions=0, never_list=set(), nested=set(),
        parent_cwds=set(), parent_sessions=set(), other=collections.Counter(),
        sessions=set()))
    tags = set(m.get("tags") or [])
    cwd = (m.get("from") or {}).get("cwd")
    role = role_of(cwd)
    r["sends"] += 1
    r["first"] = min(r["first"], m["ts"]); r["last"] = max(r["last"], m["ts"])
    h = handle_of(cwd)
    if h:
        r["handles"].add(h)
        if h not in first_send[run] or m["ts"] < first_send[run][h]:
            first_send[run][h] = m["ts"]
        if "done" in tags: r["done_handles"].add(h)
        if "checkpoint" in tags:
            r["checkpoints"] += 1; r["ckpt_handles"][h] += 1
        if m["topic"].count("/") - pref.count("/") >= 2:
            r["nested"].add(m["topic"])
    elif role == "parent":
        r["parent_cwds"].add(cwd)
        if m.get("from", {}).get("session"):
            r["parent_sessions"].add(m["from"]["session"])
    else:
        r["other"][role] += 1
    if "decision" in tags: r["decisions"] += 1
    if m.get("from", {}).get("session"): r["sessions"].add(m["from"]["session"])

# ---- session usage join ----
by_uuid = {}
for root, _, files in os.walk(SESSIONS):
    for fn in files:
        if fn.endswith(".jsonl") and "_" in fn:
            by_uuid.setdefault(fn[:-6].rsplit("_", 1)[-1], []).append(os.path.join(root, fn))

def session_usage(path):
    cost = tok_in = tok_out = cache = 0.0; models = set()
    with open(path, errors="replace") as f:
        for line in f:
            try: rec = json.loads(line)
            except json.JSONDecodeError: continue
            u = (rec.get("message") or {}).get("usage")
            if u:
                c = u.get("cost") or {}
                cost += c.get("total") or 0.0
                tok_in += u.get("input") or 0.0; tok_out += u.get("output") or 0.0
                cache += u.get("cacheRead") or 0.0
            if rec.get("type") == "model_change" and rec.get("modelId"):
                models.add(rec["modelId"])
    return cost, tok_in, tok_out, cache, models or {"?"}

def usage_for(uuids):
    cost = tin = tout = cache = 0.0; models = collections.Counter(); missing = 0
    for u in uuids:
        p = by_uuid.get(u)
        if not p: missing += 1; continue
        c, i, o, cr, mo = session_usage(p[0])
        cost += c; tin += i; tout += o; cache += cr
        for m_ in mo: models[m_] += 1
    return cost, tin, tout, cache, models, missing

# ---- dispatchers: who spawned each worker handle ----
HANDLE_RE = re.compile(r"""handle\\?["']?\s*[:=]\s*\\?["']([\w.-]+)""")
CLI_RE = re.compile(r"""wm(?:\.ts)?\s+spawn\s+["']?([\w.-]+)""")
spawns = collections.defaultdict(list)   # handle -> [(ts, cwd)]
for paths in by_uuid.values():
    for path in paths:
        cwd = None
        with open(path, errors="replace") as f:
            for line in f:
                if cwd is None:
                    try: cwd = json.loads(line).get("cwd") or ""
                    except json.JSONDecodeError: cwd = ""
                    continue
                if "toolCall" not in line or "spawn" not in line: continue
                try: rec = json.loads(line)
                except json.JSONDecodeError: continue
                for c in (rec.get("message") or {}).get("content") or []:
                    if not (isinstance(c, dict) and c.get("type") == "toolCall"): continue
                    a = c.get("arguments") or {}
                    if not isinstance(a, dict): continue
                    n = c.get("name")
                    txt = a.get("code") or a.get("command") or json.dumps(a)
                    if not isinstance(txt, str): txt = json.dumps(a)
                    hs = set(CLI_RE.findall(txt))
                    if (n == "wm" and a.get("op") == "spawn") or n == "wm_spawn" \
                            or "wm.spawn(" in txt:
                        hs |= set(HANDLE_RE.findall(txt))
                    for h in hs:
                        spawns[h].append((rec.get("timestamp") or "", cwd))

def dispatchers(run):
    root, wt, unresolved = collections.Counter(), collections.Counter(), []
    for h, t in sorted(first_send[run].items()):
        cands = [s for s in spawns.get(h, ())
                 if s[0] and s[0][:19] <= t[:19] and not s[1].endswith("/" + h)]
        if not cands: unresolved.append(h); continue
        cwd = max(cands)[1]
        (wt if "__worktrees/" in cwd else root)[cwd] += 1
    return root, wt, unresolved

def fmt_counts(c):
    return ";".join(f"{k}:{v}" for k, v in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))) or "-"

def era_of(run, first):
    if run in AFTER_RUNS: return "after"
    return "before"   # runs starting 09-14..09-15 per the ticket's era rule

rows = []
for run, r in sorted(R.items(), key=lambda kv: kv[1]["first"]):
    wc, wi, wo, wcr, wm, wmiss = usage_for(r["sessions"])  # all senders; split below
    w_sessions = set(); p_sessions = set()
    for u in r["sessions"]:
        p = by_uuid.get(u)
        if not p: continue
        (w_sessions if "__worktrees-" in p[0] else p_sessions).add(u)
    wc, wi, wo, wcr, wm, _ = usage_for(w_sessions)
    pc, pi, po, pcr, pm, _ = usage_for(p_sessions)
    never = r["handles"] - r["done_handles"]
    droot, dwt, dun = dispatchers(run)
    rows.append(dict(run=run, era=era_of(run, r["first"]), first=r["first"][:16],
        last=r["last"][:16], sends=r["sends"], workers=len(r["handles"]),
        done=len(r["done_handles"]), never=len(never), never_list=sorted(never),
        ckpt=r["checkpoints"], ckpt_h=len(r["ckpt_handles"]),
        nested=len(r["nested"]), p_cwd=len(r["parent_cwds"]),
        p_sess=len(r["parent_sessions"]), other=sum(r["other"].values()),
        droot=droot, dwt=dwt, dun=dun,
        decisions=r["decisions"], wcost=wc, pcost=pc, wtok=(wi, wo, wcr),
        models=dict(wm), missing=wmiss))

hdr = ("run","era","first_send","last_send","sends","decisions","workers","done",
       "never","never_frac","ckpt_msgs","ckpt_handles","nested_topics",
       "root_dispatchers","worktree_dispatchers","dispatch_unresolved","dispatchers",
       "board_parent_cwds","board_parent_sessions","null_or_tmp",
       "worker_$","parent_$","worker_models","missing_sessions")
def short(cwd): return cwd.replace(os.path.expanduser("~") + "/", "~/")
table = ["\t".join(hdr)]
for x in rows:
    frac = f"{x['never']/x['workers']:.3f}" if x["workers"] else "n/a"
    disp = fmt_counts(collections.Counter({short(k): v for k, v in (x["droot"] + x["dwt"]).items()}))
    table.append("\t".join(str(v) for v in (x["run"],x["era"],x["first"],x["last"],x["sends"],
        x["decisions"],x["workers"],x["done"],x["never"],frac,x["ckpt"],x["ckpt_h"],
        x["nested"],len(x["droot"]),len(x["dwt"]),len(x["dun"]),disp,
        x["p_cwd"],x["p_sess"],x["other"],round(x["wcost"],2),
        round(x["pcost"],2), fmt_counts(x["models"]), x["missing"])))
print("\n".join(table))
with open(TSV, "w") as f:
    f.write("\n".join(table) + "\n")

print("\n# worker handles with no resolvable spawn call (dispatcher unknown)")
for x in rows:
    if x["dun"]:
        print(f"  {x['run']}: {len(x['dun'])}/{x['workers']} ({', '.join(x['dun'])})")

print("\n# never-done handles per run (worker handles with no done-tagged send)")
for x in rows:
    if x["never_list"]:
        print(f"  {x['run']}: {', '.join(x['never_list'])}")

# ---- era totals, deduplicated by session ----
print("\n# era totals (sessions deduplicated within era)")
for era in ("before", "after"):
    sess = set(); runs = 0; sends = 0
    for run, r in R.items():
        if era_of(run, r["first"]) != era: continue
        runs += 1; sends += r["sends"]; sess |= r["sessions"]
    w = {u for u in sess if by_uuid.get(u) and "__worktrees-" in by_uuid[u][0]}
    p = sess - w
    wc, wi, wo, wcr, wm, wmiss = usage_for(w)
    pc, pi, po, pcr, pm, pmiss = usage_for(p)
    ers = [x for x in rows if x["era"] == era]
    workers = sum(x["workers"] for x in ers); never = sum(x["never"] for x in ers)
    root_dist = collections.Counter(len(x["droot"]) for x in ers if x["workers"])
    print(f"  {era}: runs={runs} sends={sends} worker_sessions={len(w)} "
          f"worker_${wc:.0f} worker_tok(in/out/cacheRead)={wi/1e6:.0f}M/{wo/1e6:.0f}M/{wcr/1e6:.0f}M "
          f"models={fmt_counts(wm)} | parent_sessions={len(p)} parent_${pc:.0f} "
          f"parent_tok={pi/1e6:.0f}M/{po/1e6:.0f}M/{pcr/1e6:.0f}M missing_sessions={wmiss+pmiss}")
    print(f"    handles never/workers={never}/{workers} ckpt_msgs={sum(x['ckpt'] for x in ers)} "
          f"runs_by_root_dispatchers={fmt_counts(root_dist)} "
          f"runs_with_worktree_dispatchers={sum(1 for x in ers if x['dwt'])} "
          f"unresolved_handles={sum(len(x['dun']) for x in ers)}")

# ---- reproduction of the 09-18 audit's board aggregates ----
print("\n# check vs docs/research/orchestration-audit-2026-09-18.md "
      "(its corpus = sends through 09-16 = 1194; target 217/201/16/33/9/452/34)")
sub = []
with open(LOG) as f:
    for line in f:
        try: m = json.loads(line)
        except json.JSONDecodeError: continue
        if "2026-09-14" <= m.get("ts", "")[:10] <= "2026-09-16" and run_of(m.get("topic","")):
            sub.append(m)
def hh(m): return handle_of((m.get("from") or {}).get("cwd"))
wk = [m for m in sub if hh(m)]
topics = {m["topic"] for m in wk}
handles = {hh(m) for m in wk}
done_any = {m["topic"] for m in sub if "done" in set(m.get("tags") or [])}
done_topics = {m["topic"] for m in wk if "done" in set(m.get("tags") or [])}
ck_t = collections.Counter(m["topic"] for m in wk if "checkpoint" in set(m.get("tags") or []))
ck_h = collections.Counter(hh(m) for m in wk if "checkpoint" in set(m.get("tags") or []))
print(f"  sends={len(sub)} worker_topics={len(topics)} (target 217) "
      f"done_topics_any_sender={len(topics & (done_any | {t.rsplit('/',1)[0] for t in done_any}))}"
      f" worker_handles={len(handles)} done_handles={len(handles & {hh(m) for m in wk if 'done' in set(m.get('tags') or [])})} "
      f"ckpt_topics={sum(1 for v in ck_t.values())} ge2_topics={sum(1 for v in ck_t.values() if v>=2)} "
      f"ckpt_handles={sum(1 for v in ck_h.values())} ge2_handles={sum(1 for v in ck_h.values() if v>=2)} "
      f"decision={sum(1 for m in sub if 'decision' in set(m.get('tags') or []))} "
      f"ack={sum(1 for m in sub if 'ack' in set(m.get('tags') or []))}")
print(f"\n# per-run table written to {os.path.relpath(TSV)}")
