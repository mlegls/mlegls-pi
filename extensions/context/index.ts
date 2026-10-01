// context: when and how a session's context is managed. Two memory mechanisms, one active per
// session (/memory switches; ./compaction.ts): ./journal.ts, the agent's own entries written
// through a `journal` tool and rendered back as those tool calls, and observational memory (./om,
// vendored from pi-observational-memory with its ledger moved into the records store as the `om`
// schema), which observes and reflects per memory.schemas.om.observe (always | active | never). The active one triggers
// compaction; if the journal checkpoint fails, OM renders instead. ./elide.ts drops old tool outputs behind
// cold-cache gaps. This extension adds policy on top.
//
// Fence, for spawned workers (PI_BOARD_TOPIC set): when usage crosses the threshold, steer the
// agent once with AGENTS_DIR/_fence.md (finish if within reach, else checkpoint into the ticket
// and report `checkpoint`), then compact when its loop ends, so a parent's follow-up lands in a
// compacted context. Re-arms when usage drops back under, so a worker told to continue gets
// fenced again on its next lap.
//
// Threshold: PI_CHECKPOINT (a ratio, set by wm from the agent's `checkpoint:` frontmatter),
// else by window size: 0.3 for ~1M windows, 0.6 for ~272k.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerCompaction } from "./compaction.ts";
import observationalMemory from "./om/index.ts";
import journal from "./journal.ts";
import elide from "./elide.ts";

const AGENTS_DIR = process.env.PI_AGENTS_DIR ?? join(homedir(), ".pi", "agent", "agents");

function threshold(contextWindow: number): number {
	const env = Number(process.env.PI_CHECKPOINT);
	if (Number.isFinite(env) && env > 0) return env > 1 ? env / 100 : env;
	return contextWindow >= 400_000 ? 0.3 : 0.6;
}

function fenceText(percent: number, topic: string): string {
	const file = join(AGENTS_DIR, "_fence.md");
	const text = existsSync(file)
		? readFileSync(file, "utf8")
		: "checkpoint: this session is at {{percent}}% of its context. finish if within reach; otherwise update the ticket, commit, report `checkpoint` on `{{topic}}`, and wait.";
	return text.replaceAll("{{percent}}", String(Math.round(percent))).replaceAll("{{topic}}", topic).trim();
}

export default function (pi: ExtensionAPI) {
	elide(pi); // before the journal's context hook, so its snapshot and checkpoints see elided bodies
	registerCompaction(pi, [journal(pi), observationalMemory(pi)]);
	const topic = process.env.PI_BOARD_TOPIC;
	if (!topic) return;
	let armed = true;
	let fired = false;

	pi.on("turn_end", async (_ev, ctx) => {
		const u = ctx.getContextUsage();
		if (!u || u.percent === null) return;
		const ratio = u.percent / 100;
		const t = threshold(u.contextWindow);
		if (!armed) {
			if (ratio < t) armed = true;
			return;
		}
		if (ratio < t) return;
		armed = false;
		fired = true;
		pi.sendUserMessage(fenceText(u.percent, topic), { deliverAs: "steer" });
	});

	pi.on("agent_end", async (_ev, ctx) => {
		if (!fired) return;
		fired = false;
		const u = ctx.getContextUsage();
		if (!u || u.percent === null || u.percent / 100 < threshold(u.contextWindow)) return;
		ctx.compact({ onError: () => {} }); // already compacting, or nothing to compact
	});
}
