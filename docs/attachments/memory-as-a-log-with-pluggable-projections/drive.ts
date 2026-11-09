// Keyless first-use setup for the parent join. Seeded worker output, real store/hooks/tools.
// Run from the repository root: bun docs/attachments/memory-as-a-log-with-pluggable-projections/drive.ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const scratch = mkdtempSync(join(tmpdir(), "memory-log-join-"));
const saved = { board: process.env.PI_BOARD_DIR, agent: process.env.PI_CODING_AGENT_DIR };
process.env.PI_BOARD_DIR = join(scratch, "store");
process.env.PI_CODING_AGENT_DIR = join(scratch, "agent");
mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
const cwd = join(scratch, "project");
mkdirSync(join(cwd, ".pi"), { recursive: true });
writeFileSync(join(cwd, ".pi/settings.json"), JSON.stringify({ memory: { systems: ["om"], schemas: { om: { budget: 1, compaction: { summaryMaxTokens: 512 } } } } }));
const requireThat = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
try {
	const { default: context } = await import("../../../extensions/context/index.ts");
	const { recordLedger } = await import("../../../extensions/context/om/session-ledger/store.ts");
	const { db, select, storePath } = await import("../../../lib/records/store.ts");
	const { activeMechanism } = await import("../../../extensions/context/mechanism.ts");
	const handlers = new Map<string, Function[]>(), tools = new Map<string, any>();
	const api = {
		on(name: string, fn: Function) { handlers.set(name, [...(handlers.get(name) ?? []), fn]); },
		registerTool(tool: any) { tools.set(tool.name, tool); },
		registerCommand() {}, registerMessageRenderer() {},
		events: { on() {}, emit() {} },
		getActiveTools: () => [...tools.keys()], setActiveTools() {},
	} as any;
	context(api);
	const message = (id: string, content: string, parentId: string | null = null) => ({ type: "message", id, parentId, timestamp: "2026-11-09T12:00:00.000Z", message: { role: "user", content, timestamp: 1794225600000 } });
	const a1 = message("a1", "Use the records store for immutable memory."), a2 = message("a2", "Keep citations to source entries.", "a1"), a3 = message("a3", "This is the main-only continuation.", "a2"), keep = message("keep", "Continue after compaction.", "a3");
	const parentFile = join(scratch, "parent.jsonl");
	writeFileSync(parentFile, JSON.stringify({ type: "session", id: "join-parent" }) + "\n");
	let branch: any[] = [a1, a2, a3, keep], sessionId = "join-parent", leaf = "a2", parentSession: string | undefined;
	const sm = { getSessionId: () => sessionId, getLeafId: () => leaf, getBranch: () => branch, getHeader: () => ({ parentSession }), getSessionFile: () => parentFile };
	const observation = { id: "aaaaaaaaaaa1", content: "The store is immutable and preserves source citations.", timestamp: "2026-11-09 12:00", relevance: "high", sourceEntryIds: ["a1", "a2"], tokenCount: 15 };
	const reflection = { id: "bbbbbbbbbbb1", content: "Memory records preserve their evidence.", supportingObservationIds: [observation.id], tokenCount: 10 };
	const onlyMain = { ...observation, id: "aaaaaaaaaaa2", content: "Main-only continuation.", sourceEntryIds: ["a3"] };
	recordLedger(sm, "om.observations.recorded", { observations: [observation], coversUpToId: "a2" });
	recordLedger(sm, "om.reflections.recorded", { reflections: [reflection], coversUpToId: "a2" });
	leaf = "a3";
	recordLedger(sm, "om.observations.recorded", { observations: [onlyMain], coversUpToId: "a3" });
	recordLedger(sm, "om.observations.dropped", { observationIds: [observation.id], coversUpToId: "a3" });
	leaf = "keep";
	const ctx = { cwd, sessionManager: sm, model: { contextWindow: 4096 }, hasUI: false } as any;
	requireThat(activeMechanism(ctx) === "om", "OM must own compaction");
	const compact = async () => {
		const event = { branchEntries: branch, preparation: { firstKeptEntryId: branch.at(-1).id, tokensBefore: 4000 }, signal: new AbortController().signal };
		const result = await handlers.get("session_before_compact")![0]!(event, ctx);
		return result?.compaction;
	};
	const recalled = async (id: string) => tools.get("recall").execute("join", { q: id }, new AbortController().signal, undefined, ctx);
	const main = await compact();
	requireThat(main?.details.type === "om.folded" && !main.details.sections, "OM details must remain intact");
	requireThat(main.summary.includes(reflection.id) && main.summary.includes(onlyMain.id) && !main.summary.includes(observation.id), "full fold must render reflection/main memory and hide dropped observation");
	requireThat(Math.ceil(main.summary.length / 4) <= 512, "finite render cap");
	const renderedId = main.summary.match(/\[([a-f0-9]{12})\]/)![1];
	const recall = await recalled(renderedId);
	requireThat(recall.details.status === "ok" && recall.details.sourceEntries.map((e: any) => e.id).join(",") === "a1,a2", "rendered reflection must resolve through dropped observation to sources");
	requireThat(recall.content.some((c: any) => c.text?.includes(a1.message.content)), "recall must include source text");
	console.log("MAIN", JSON.stringify({ renderer: activeMechanism(ctx), budget: 512, summaryTokens: Math.ceil(main.summary.length / 4), renderedId, recallStatus: recall.details.status, sourceEntryIds: recall.details.sourceEntries.map((e: any) => e.id) }));
	branch = [a1, message("sibling", "Sibling before memory was written.", "a1")]; leaf = "sibling";
	requireThat(await compact() === undefined, "sibling must not render main branch memory");
	const hidden = await recalled(renderedId);
	requireThat(!hidden.details && hidden.content[0].text.includes("om.id = " + renderedId), "off-branch recall must fall back to the global raw record, without source expansion");
	console.log("SIBLING", JSON.stringify({ rendered: false, recall: hidden.content[0].text }));
	sessionId = "join-fork"; parentSession = parentFile;
	branch = [a1, a2, message("fork", "Fork at a2.", "a2")]; leaf = "fork";
	const fork = await compact(), inherited = await recalled(renderedId), hiddenMain = await recalled(onlyMain.id);
	requireThat(fork.summary.includes(reflection.id) && fork.summary.includes(observation.id) && !fork.summary.includes(onlyMain.id), "fork must inherit a2 memories but not a3 drop or observation");
	requireThat(inherited.details.status === "ok" && inherited.details.observations[0].status === "active", "fork observation must not inherit later drop");
	requireThat(!hiddenMain.details && hiddenMain.content[0].text.includes("om.id = " + onlyMain.id), "off-fork id lookup returns a global raw record without source expansion");
	console.log("FORK", JSON.stringify({ inherits: [observation.id, reflection.id], excludes: onlyMain.id, sourceEntryIds: inherited.details.sourceEntries.map((e: any) => e.id), observationStatus: inherited.details.observations[0].status }));
	console.log("STORE", JSON.stringify({ isolated: storePath().startsWith(scratch), omRecords: select("om").length, transcriptOmCustomEntries: branch.filter((e) => e.customType?.startsWith("om.")).length }));
	// Optional deterministic upstream replay over the same seeded ledger. No live model calls.
	if (process.env.OM_UPSTREAM_HOME) {
		const custom = (id: string, parentId: string, customType: string, data: unknown) => ({ type: "custom", id, parentId, timestamp: "2026-11-09T12:00:00.000Z", customType, data });
		const fixture = join(scratch, "legacy.jsonl");
		writeFileSync(fixture, [{ type: "session", id: "join-replay" }, a1, a2,
			custom("o1", "a2", "om.observations.recorded", { observations: [observation], coversUpToId: "a2" }),
			custom("r1", "o1", "om.reflections.recorded", { reflections: [reflection], coversUpToId: "a2" }),
			{ ...a3, parentId: "r1" },
			custom("o2", "a3", "om.observations.recorded", { observations: [onlyMain], coversUpToId: "a3" }),
			custom("d1", "o2", "om.observations.dropped", { observationIds: [observation.id], coversUpToId: "a3" }),
			{ ...keep, parentId: "d1" },
			{ type: "compaction", id: "c1", parentId: "keep", firstKeptEntryId: "keep", summary: main.summary, tokensBefore: 4000 },
		].map((e) => JSON.stringify(e)).join("\n") + "\n");
		const replay = spawnSync("bun", ["extensions/context/om/session-ledger/replay-upstream.ts", fixture], { env: { ...process.env, HOME: process.env.OM_UPSTREAM_HOME, TMPDIR: scratch }, encoding: "utf8" });
		console.log("UPSTREAM", replay.stdout.trim());
		requireThat(replay.status === 0 && replay.stdout.includes('"diffs":0') && !replay.stdout.includes("DIFF"), replay.stderr || replay.stdout);
	}
	db().close();
} finally {
	if (saved.board === undefined) delete process.env.PI_BOARD_DIR; else process.env.PI_BOARD_DIR = saved.board;
	if (saved.agent === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = saved.agent;
	rmSync(scratch, { recursive: true, force: true });
}
