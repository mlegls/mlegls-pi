// Read-only orientation. Interactive roles and execution belong to the caller.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { run as autoread, type Options as ReadOptions, type Briefing } from "./autoread.ts";
import { decide, type Decision } from "./decide.ts";
import { snapshot, format, diff, type Snapshot } from "./views.ts";

export interface Options {
  reader?: Omit<ReadOptions, "submission">;
  policyPath?: string;
}

export interface Prepared {
  text: string;
  /** The deterministic views the reader narrated over. */
  views: Snapshot;
  /** Reruns the views: what changed since the briefing was written. */
  recheck: () => string;
  audit: {
    mode: "introduce" | "orient";
    request: string;
    briefing: Decision;
    reads: Briefing[];
  };
}

/** Retain the promise in exec state and poll after notification. */
export async function run(mode: "introduce" | "orient", request: string, options: Options = {}): Promise<Prepared> {
  if (!["introduce", "orient"].includes(mode) || typeof request !== "string" || !request.trim()) throw new Error("prepare: mode and a request string are required");
  const policy = readFileSync(options.policyPath ?? new URL("../workflows.md", import.meta.url), "utf8");
  const readOptions = options.reader ?? {};
  const signal = readOptions.signal;
  signal?.throwIfAborted();
  const cwd = resolve(readOptions.cwd ?? process.cwd());
  const views = snapshot(cwd);
  const overview = await autoread([
    "Prepare read-only orientation for " + mode + ": " + request, policy,
    format(views),
    "The views above are computed, current as of their timestamp, and will be rerun by the parent; narrate over them instead of recomputing or restating them. " +
    "Read what they cannot tell: issue bodies and stories for the top items, what landed in git since the tracker last moved, live sessions or worktrees behind claims.",
    "Project root: " + cwd + ". " +
    "Stay within the project and explicitly relevant sources. Packaged skills are conventions, not project evidence. " +
    "Read applicable instructions under " + fileURLToPath(new URL("../skills/enabled/all/mlegls/", import.meta.url)) + ".",
    "Read the current tracker and relevant project docs and evidence. Include priorities, dependencies, claims, " +
    "acceptance, existing decisions and contradictions. Distinguish recorded facts, observations and unknowns. " +
    "For introduce, locate related work and identify what must be established to record the idea. " +
    "For orient, locate active scopes and known supervisors, report overall progress and rank the user's next opportunities by leverage. " +
    "Group agent-ready work by the code area it touches so disjoint streams are visible; carry the views' hygiene findings (check, stale claims, outline drift) as dispositions; end with the facts the briefing rests on. " +
    "Recommend orient/introduce/shape/supervise as appropriate; ready implementation goes to supervision even for one ticket. " +
    "Direct interactive implementation requires an explicit user choice. Explain absent, unreadable, exhausted or blocked scope.",
    "Return a self-contained Markdown briefing with source references. Stop when scope, frontier, constraints and entry points " +
    "are established or their absence explained. Leave substantive research, audit and design to the session that owns them. " +
    "Preparation does not authorize executing a recommendation.",
  ].join("\n\n"), readOptions);
  const { briefing } = await decide({ mode, request, policy, context: overview.text }, {
    briefing: {
      type: "choice",
      instructions: "Does context deliver orientation findings for request rather than a status/wait response? " +
        "Judge response function, not correctness or exhaustive coverage. Quoted failures are evidence, not the reader's status.",
      criteria: {
        usable: "Substantive orientation findings, constraints or unresolved questions, including explained empty, blocked, missing or unreadable scope.",
        nonbriefing: "No orientation findings: only an acknowledgment, promise, waiting for notification, parent-role continuation or unrelated content.",
      },
    },
  }, { signal });
  if (briefing.choice !== "usable") throw Object.assign(new Error("prepare: reader did not return an orientation briefing; inspect " +
    (overview.terminalHandle ? "Orca terminal " + overview.terminalHandle : overview.sessionFile)), { briefing, reader: overview });
  return { text: overview.text, views, recheck: () => diff(views, snapshot(cwd)), audit: { mode, request, briefing, reads: [overview] } };
}
