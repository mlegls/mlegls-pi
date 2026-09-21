// Read-only orientation. Interactive roles and execution belong to the caller.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { run as autoread, type Options as ReadOptions, type Briefing } from "./autoread.ts";
import { decide, type Decision } from "./decide.ts";

export interface Options {
  reader?: Omit<ReadOptions, "submission">;
  policyPath?: string;
}

export interface Prepared {
  text: string;
  audit: {
    mode: "introduce" | "orient";
    request: string;
    briefing: Decision;
    reads: Briefing[];
  };
}

/** Retain the promise in exec state and poll after notification. */
export async function run(mode: "introduce" | "orient", request: string, options: Options = {}): Promise<Prepared> {
  if (!["introduce", "orient"].includes(mode) || !request.trim()) throw new Error("prepare: mode and request required");
  const policy = readFileSync(options.policyPath ?? new URL("../workflows.md", import.meta.url), "utf8");
  const readOptions = options.reader ?? {};
  const signal = readOptions.signal;
  signal?.throwIfAborted();
  const overview = await autoread([
    "Prepare read-only orientation for " + mode + ": " + request, policy,
    "Project root: " + resolve(readOptions.cwd ?? process.cwd()) + ". " +
    "Stay within the project and explicitly relevant sources. Packaged skills are conventions, not project evidence. " +
    "Read applicable instructions under " + fileURLToPath(new URL("../skills/enabled/all/mlegls/", import.meta.url)) + ".",
    "Read the current tracker and relevant project docs and evidence. Include priorities, dependencies, claims, " +
    "acceptance, existing decisions and contradictions. Distinguish recorded facts, observations and unknowns. " +
    "For introduce, locate related work and identify what must be established to record the idea. " +
    "For orient, locate active scopes and known supervisors, report overall progress and rank the user's next opportunities by leverage. " +
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
  return { text: overview.text, audit: { mode, request, briefing, reads: [overview] } };
}
