// wm: the interactive face of lib/wm.ts. Spawn pi workers in workmux worktrees from a
// session and hear back either in the same turn (`wm_wait`, or `wm_spawn` with `wait`) or
// through the board without polling: `wm_spawn` subscribes this session (wake) to each
// worker's topic `<run>/<handle>`, so a done / blocked / needs-input / checkpoint that arrives
// while you're doing something else lands as a turn. Reports `wm_wait` already returned are
// marked seen on the board so they aren't repeated. The rest (`wm` send, capture, merge,
// close, status) is what you'd do to a worker after that.
//
// `run` is remembered per session after the first spawn; `bun lib/wm.ts` remains the
// CLI for scripts and for `status` / `agents`, whose output is worth piping.

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { attach, MergeConflict, merge, spawn, wait, workmuxStatus, type Outcome, type Worker } from "../../lib/wm";

const Operations = ["send", "capture", "merge", "close", "status"] as const;
const WaitModes = ["any", "all"] as const;
const RUN_ENTRY = "wm-run";
const REPORT_TAGS = "done | blocked | needs-input | checkpoint";

const RunParam = Type.Optional(Type.String({ description: "Board topic prefix the run reports under, e.g. compile/1726 or orch/rework-auth. Remembered after the first spawn." }));

const SpawnParameters = Type.Object({
	run: RunParam,
	workers: Type.Array(
		Type.Object({
			handle: Type.String({ description: "Worker handle: its branch, worktree, tmux window, and board sender name." }),
			prompt: Type.String({ description: "The task. The agent's body and the common reporting preamble are added around it." }),
			agent: Type.Optional(Type.String({ description: "Agent file name under ~/.pi/agent/agents (see `bun lib/wm.ts agents`), else a raw command." })),
			base: Type.Optional(Type.String({ description: "Git ref to branch from. Default: current HEAD." })),
		}),
		{ description: "Workers to spawn, in parallel." },
	),
	wake: Type.Optional(Type.Boolean({ description: "Whether the workers' board reports start a turn here when they arrive outside a wait. Default true; false still injects them next turn." })),
	wait: Type.Optional(Type.Boolean({ description: "Block until every spawned worker has reported (or gone idle/exited), returning their outcomes like wm_wait mode all. Default false: return as soon as they're running." })),
});

const WaitParameters = Type.Object({
	handles: Type.Optional(Type.Array(Type.String(), { description: "Workers to wait on. Default: every worker spawned this session and not closed." })),
	run: RunParam,
	mode: Type.Optional(StringEnum(WaitModes, { description: "any: return on the first report (default). all: return once every worker has reported." })),
	timeoutMs: Type.Optional(Type.Number({ description: "Give up after this long and report who's still pending. Default: wait indefinitely." })),
});

const Parameters = Type.Object({
	op: StringEnum(Operations, { description: "Operation to perform." }),
	handle: Type.Optional(Type.String({ description: "Worker handle. Required except for status." })),
	run: RunParam,
	text: Type.Optional(Type.String({ description: "send: text to type into the worker's pi prompt." })),
	lines: Type.Optional(Type.Number({ description: "capture: trailing pane lines. Default 50." })),
	into: Type.Optional(Type.String({ description: "merge: branch to merge into. Default: the current branch." })),
	mode: Type.Optional(StringEnum(["merge", "rebase"] as const, { description: "merge: --no-ff merge (default) or rebase the worker onto `into` then fast-forward." })),
	keepBranch: Type.Optional(Type.Boolean({ description: "close: keep the branch after removing worktree and branch." })),
});

type WorkerJSON = ReturnType<Worker["toJSON"]>;

interface OutcomeJSON {
	handle: string;
	kind: Outcome["kind"];
	line?: number;
}

interface Details {
	op: "spawn" | "wait" | typeof Operations[number];
	workers?: WorkerJSON[];
	outcomes?: OutcomeJSON[];
	pending?: string[];
	conflicts?: string[];
}

function renderOutcome(w: Worker, o: Outcome): string {
	if (o.kind === "idle" || o.kind === "exited") {
		const why = o.kind === "idle" ? "ended its turn without reporting" : "pi exited";
		return `${w.handle}  ${o.kind}  (${why})\n${o.tail ? indent(o.tail) : "  (no pane output)"}`;
	}
	const m = o.message;
	const data = m.data !== undefined ? `\n${indent(JSON.stringify(m.data))}` : "";
	return `${w.handle}  ${o.kind}  [${m.tags.join(" ")}]\n${indent(m.body)}${data}`;
}

function indent(s: string): string {
	return s
		.split("\n")
		.map((l) => `  ${l}`)
		.join("\n");
}

export default function (pi: ExtensionAPI) {
	let cwd = "";
	let run: string | undefined;
	const workers = new Map<string, Worker>();

	pi.on("session_start", (_event, ctx) => {
		cwd = ctx.cwd;
		run = undefined;
		workers.clear();
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "custom" && entry.customType === RUN_ENTRY) run = entry.data as string;
		}
	});

	function need<T>(v: T | undefined, what: string): T {
		if (v === undefined || v === "") throw new Error(`${what} required`);
		return v;
	}

	function worker(handle: string, runParam?: string): Worker {
		const r = need(runParam ?? run, "run (no spawn yet this session)");
		const key = `${r}/${handle}`;
		let w = workers.get(key);
		if (!w) {
			w = attach(r, handle, cwd);
			workers.set(key, w);
		}
		return w;
	}

	function remember(r: string) {
		if (run === r) return;
		run = r;
		pi.appendEntry(RUN_ENTRY, run);
	}

	/** Block on the workers; render what arrived and who's still pending, and tell the board what the model has now seen. */
	async function waitOn(ws: Worker[], opts: { mode: "any" | "all"; timeoutMs?: number; signal?: AbortSignal }, details: Details): Promise<string> {
		const got = await wait(ws, opts);
		const ids: string[] = [];
		details.outcomes = [];
		for (const [w, o] of got) {
			if (o.kind !== "idle" && o.kind !== "exited") ids.push(o.message.id);
			details.outcomes.push({ handle: w.handle, kind: o.kind });
		}
		if (ids.length) pi.events.emit("board:seen", { ids });
		details.pending = ws.filter((w) => !got.has(w)).map((w) => w.handle);
		const lines = [...got].map(([w, o]) => renderOutcome(w, o));
		if (details.pending.length) lines.push(`pending: ${details.pending.join(", ")}`);
		if (!got.size) lines.unshift(opts.signal?.aborted ? "wait aborted" : "wait timed out");
		return lines.join("\n\n");
	}

	pi.registerTool({
		name: "wm_spawn",
		label: "Spawn Workers",
		description:
			"Spawn pi workers in workmux worktrees, in parallel: each gets a branch + worktree + tmux window running an agent with your prompt, and this session is subscribed to its board topic so its done/blocked/needs-input/checkpoint reaches you. With wait:true, block until they've all reported (subagent style). Otherwise return at once and use wm_wait, or let the reports wake you.",
		promptSnippet: "Spawn pi workers in worktrees",
		promptGuidelines: [
			"Delegate with wm_spawn, listing every independent unit in one call. wait:true when the results are what you need next; otherwise carry on and wm_wait, or let their reports wake you.",
		],
		parameters: SpawnParameters,
		async execute(_id, p, signal) {
			const r = need(p.run ?? run, "run");
			const details: Details = { op: "spawn" };
			const ws = await Promise.all(p.workers.map((o) => spawn({ run: r, handle: o.handle, prompt: o.prompt, agent: o.agent, base: o.base, cwd })));
			remember(r);
			const wake = p.wake ?? true;
			for (const w of ws) {
				workers.set(w.topic, w);
				pi.events.emit("board:subscribe", { topic: w.topic, tags: REPORT_TAGS, wake });
			}
			details.workers = ws.map((w) => w.toJSON());
			const spawned = ws.map((w) => `spawned ${w.handle} in ${w.dir}`).join("\n");
			const subscribed = `subscribed ${wake ? "wake" : "quiet"} ${r}/{${ws.map((w) => w.handle).join(",")}} :: ${REPORT_TAGS}`;
			if (!p.wait) return { content: [{ type: "text", text: `${spawned}\n${subscribed}` }], details };
			const text = await waitOn(ws, { mode: "all", signal }, details);
			return { content: [{ type: "text", text: `${spawned}\n\n${text}` }], details };
		},
		renderCall(args, theme) {
			const ws = (args.workers ?? []) as Array<{ handle: string; agent?: string; prompt: string }>;
			let text = theme.fg("toolTitle", theme.bold("wm_spawn")) + (args.wait ? theme.fg("accent", " +wait") : "");
			for (const w of ws) {
				text += `\n  ${theme.fg("muted", w.handle)}${w.agent ? theme.fg("dim", ` (${w.agent})`) : ""}  ${theme.fg("dim", w.prompt.split("\n")[0]!.slice(0, 100))}`;
			}
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded }, theme) {
			const d = result.details as Details | undefined;
			const body = result.content.map((c) => (c.type === "text" ? c.text : "")).join("");
			if (expanded) return new Text(body, 0, 0);
			const n = d?.workers?.length ?? 0;
			const outcomes = d?.outcomes?.map((o) => `${o.handle}:${o.kind}`).join(" ");
			return new Text(theme.fg("success", `spawned ${n}`) + (outcomes ? `  ${outcomes}` : ""), 0, 0);
		},
	});

	pi.registerTool({
		name: "wm_wait",
		label: "Wait for Workers",
		description:
			"Block until workers report on the board (done/blocked/needs-input/checkpoint), go idle without reporting, or exit. mode any returns on the first; mode all once every listed worker has one. Returns each report's body (or the pane tail for idle/exited) and who's still pending.",
		promptSnippet: "Wait for workers' reports",
		promptGuidelines: [
			"wm_wait on several workers at once instead of capturing them one by one; mode any when you'll act on each as it lands, all when you need the set.",
		],
		parameters: WaitParameters,
		async execute(_id, p, signal) {
			const details: Details = { op: "wait" };
			const ws = p.handles ? p.handles.map((h) => worker(h, p.run)) : [...workers.values()];
			if (!ws.length) throw new Error("no workers to wait on (none spawned this session; pass handles)");
			details.workers = ws.map((w) => w.toJSON());
			const text = await waitOn(ws, { mode: p.mode ?? "any", timeoutMs: p.timeoutMs, signal }, details);
			return { content: [{ type: "text", text }], details };
		},
		renderCall(args, theme) {
			const who = args.handles?.length ? args.handles.join(", ") : "all";
			return new Text(theme.fg("toolTitle", theme.bold("wm_wait ")) + theme.fg("accent", args.mode ?? "any") + ` ${theme.fg("muted", who)}`, 0, 0);
		},
		renderResult(result, { expanded }, theme) {
			const d = result.details as Details | undefined;
			const body = result.content.map((c) => (c.type === "text" ? c.text : "")).join("");
			if (expanded) return new Text(body, 0, 0);
			const outcomes = d?.outcomes?.map((o) => `${o.handle}:${o.kind}`).join(" ") ?? "";
			const pending = d?.pending?.length ? theme.fg("muted", `  pending ${d.pending.join(",")}`) : "";
			return new Text((outcomes ? theme.fg("success", outcomes) : theme.fg("warning", body.split("\n")[0]!)) + pending, 0, 0);
		},
	});

	pi.registerTool({
		name: "wm",
		label: "Workers",
		description:
			"Steer pi workers spawned with wm_spawn. send types into the worker's prompt; capture shows its pane; merge brings its branch in (conflicts are returned, the merge aborted); close removes worktree, window, and branch; status lists the repo's workers.",
		promptSnippet: "Steer, merge, and close pi workers",
		promptGuidelines: [
			"Steer workers with wm send. Use board_send to the worker's topic when the message belongs in the shared record.",
		],
		parameters: Parameters,
		async execute(_id, p) {
			const details: Details = { op: p.op };
			const text = async (): Promise<string> => {
				switch (p.op) {
					case "send": {
						const w = worker(need(p.handle, "handle"), p.run);
						await w.send(need(p.text, "text"));
						details.workers = [w.toJSON()];
						return `sent to ${w.handle}`;
					}
					case "capture": {
						const w = worker(need(p.handle, "handle"), p.run);
						const entry = (await workmuxStatus(w.cwd)).find((e) => e.worktree === w.handle);
						if (entry?.pane_id) w.paneId = entry.pane_id;
						details.workers = [w.toJSON()];
						const out = await w.capture(p.lines ?? 50);
						return out || `(no pane for ${w.handle}; status: ${entry?.status ?? "unknown"})`;
					}
					case "merge": {
						const w = worker(need(p.handle, "handle"), p.run);
						details.workers = [w.toJSON()];
						try {
							await merge(w, { into: p.into, mode: p.mode });
						} catch (e) {
							if (!(e instanceof MergeConflict)) throw e;
							details.conflicts = e.files;
							throw new Error(`merge of ${w.branch} aborted, conflicts in:\n${e.files.join("\n")}\nsend the worker the list to resolve, or resolve in its worktree ${w.dir}`);
						}
						return `merged ${w.branch}${p.into ? ` into ${p.into}` : ""} (${p.mode ?? "merge"})`;
					}
					case "close": {
						const w = worker(need(p.handle, "handle"), p.run);
						await w.close(p.keepBranch ?? false);
						workers.delete(w.topic);
						pi.events.emit("board:subscribe", { topic: w.topic, tags: REPORT_TAGS, remove: true });
						return `closed ${w.handle}${p.keepBranch ? " (branch kept)" : ""}`;
					}
					case "status": {
						const entries = await workmuxStatus(cwd);
						if (!entries.length) return "(no workers)";
						return entries.map((e) => `${e.worktree}  ${e.status}  ${e.branch}  ${e.pane_id}`).join("\n");
					}
				}
			};
			return { content: [{ type: "text", text: await text() }], details };
		},
		renderCall(args, theme) {
			let text = theme.fg("toolTitle", theme.bold("wm ")) + theme.fg("accent", args.op);
			if (args.handle) text += ` ${theme.fg("muted", args.handle)}`;
			if (args.op === "send" && args.text) text += `\n  ${theme.fg("dim", args.text.split("\n")[0]!.slice(0, 120))}`;
			return new Text(text, 0, 0);
		},
		renderResult(result, { expanded }, theme) {
			const d = result.details as Details | undefined;
			const body = result.content.map((c) => (c.type === "text" ? c.text : "")).join("");
			if (d?.conflicts) return new Text(theme.fg("warning", `conflicts: ${d.conflicts.join(", ")}`), 0, 0);
			const first = body.split("\n")[0]!;
			return new Text(expanded || d?.op === "status" ? body : theme.fg("success", first), 0, 0);
		},
	});
}
