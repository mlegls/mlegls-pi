// wm: the interactive face of lib/wm.ts. Spawn pi workers in workmux worktrees from a
// session and hear back through the board without polling: `spawn` subscribes this
// session (wake) to the worker's topic `<run>/<handle>` the moment it exists, so the
// worker's done / blocked / needs-input / checkpoint lands as a turn. The rest (send, capture,
// merge, close) is what you'd do to a worker after that.
//
// `run` is remembered per session after the first spawn; `bun lib/wm.ts` remains the
// CLI for scripts and for `status` / `agents`, whose output is worth piping.

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { attach, MergeConflict, merge, spawn, workmuxStatus, type Worker } from "../../lib/wm";

const Operations = ["spawn", "send", "capture", "merge", "close", "status"] as const;
const RUN_ENTRY = "wm-run";

const Parameters = Type.Object({
	op: StringEnum(Operations, { description: "Operation to perform." }),
	handle: Type.Optional(Type.String({ description: "Worker handle: its branch, worktree, tmux window, and board sender name. Required except for status." })),
	run: Type.Optional(Type.String({ description: "Board topic prefix the run reports under, e.g. compile/1726 or orch/rework-auth. Remembered after the first spawn." })),
	prompt: Type.Optional(Type.String({ description: "spawn: the task. The agent's body and the common reporting preamble are added around it." })),
	agent: Type.Optional(Type.String({ description: "spawn: agent file name under ~/.pi/agent/agents (see `bun lib/wm.ts agents`), else a raw command." })),
	base: Type.Optional(Type.String({ description: "spawn: git ref to branch from. Default: current HEAD." })),
	wake: Type.Optional(Type.Boolean({ description: "spawn: whether the worker's terminal reports start a turn here. Default true; false still injects them next turn." })),
	text: Type.Optional(Type.String({ description: "send: text to type into the worker's pi prompt." })),
	lines: Type.Optional(Type.Number({ description: "capture: trailing pane lines. Default 50." })),
	into: Type.Optional(Type.String({ description: "merge: branch to merge into. Default: the current branch." })),
	mode: Type.Optional(StringEnum(["merge", "rebase"] as const, { description: "merge: --no-ff merge (default) or rebase the worker onto `into` then fast-forward." })),
	keepBranch: Type.Optional(Type.Boolean({ description: "close: keep the branch after removing worktree and window." })),
});

interface Details {
	op: typeof Operations[number];
	worker?: ReturnType<Worker["toJSON"]>;
	conflicts?: string[];
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

	pi.registerTool({
		name: "wm",
		label: "Workers",
		description:
			"Spawn and steer pi workers in workmux worktrees. spawn creates branch + worktree + tmux window running an agent with your prompt, and subscribes this session to the worker's board topic so its done/blocked/needs-input/checkpoint reaches you. send types into the worker's prompt; capture shows its pane; merge brings its branch in (conflicts are returned, the merge aborted); close removes worktree, window, and branch; status lists the repo's workers.",
		promptSnippet: "Spawn and steer pi workers in worktrees",
		promptGuidelines: [
			"Delegate tasks with wm spawn. It subscribes this session to the worker's done, blocked, needs-input, and checkpoint reports, with wake enabled by default.",
			"Steer workers with wm send. Use board_send to the worker's topic when the message belongs in the shared record.",
		],
		parameters: Parameters,
		async execute(_id, p) {
			const details: Details = { op: p.op };
			const text = async (): Promise<string> => {
				switch (p.op) {
					case "spawn": {
						const r = need(p.run ?? run, "run");
						const w = await spawn({ run: r, handle: need(p.handle, "handle"), prompt: need(p.prompt, "prompt"), agent: p.agent, base: p.base, cwd });
						workers.set(w.topic, w);
						if (run !== r) {
							run = r;
							pi.appendEntry(RUN_ENTRY, run);
						}
						const wake = p.wake ?? true;
						pi.events.emit("board:subscribe", { topic: w.topic, tags: "done | blocked | needs-input | checkpoint", wake });
						details.worker = w.toJSON();
						return `spawned ${w.handle} in ${w.dir}\nsubscribed ${wake ? "wake" : "quiet"} ${w.topic} :: done | blocked | needs-input | checkpoint`;
					}
					case "send": {
						const w = worker(need(p.handle, "handle"), p.run);
						await w.send(need(p.text, "text"));
						details.worker = w.toJSON();
						return `sent to ${w.handle}`;
					}
					case "capture": {
						const w = worker(need(p.handle, "handle"), p.run);
						const entry = (await workmuxStatus(w.cwd)).find((e) => e.worktree === w.handle);
						if (entry?.pane_id) w.paneId = entry.pane_id;
						details.worker = w.toJSON();
						const out = await w.capture(p.lines ?? 50);
						return out || `(no pane for ${w.handle}; status: ${entry?.status ?? "unknown"})`;
					}
					case "merge": {
						const w = worker(need(p.handle, "handle"), p.run);
						details.worker = w.toJSON();
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
						pi.events.emit("board:subscribe", { topic: w.topic, tags: "done | blocked | needs-input | checkpoint", remove: true });
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
			if (args.op === "spawn" && args.agent) text += ` ${theme.fg("muted", `(${args.agent})`)}`;
			if (args.op === "spawn" && args.prompt) text += `\n  ${theme.fg("dim", args.prompt.split("\n")[0]!.slice(0, 120))}`;
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
