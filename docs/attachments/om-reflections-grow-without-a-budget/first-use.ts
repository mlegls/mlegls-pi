// First-use fixture, not a test: print the real compaction hook's result for inspection.
// No model calls, credentials, or live-session writes. --session replays a read-only snapshot.
import { Database } from "bun:sqlite";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { registerMechanisms } from "../../../extensions/context/mechanism.ts";
import { DEFAULTS } from "../../../extensions/context/om/config.ts";
import { compactionMechanism } from "../../../extensions/context/om/hooks/compaction-hook.ts";
import { Runtime } from "../../../extensions/context/om/runtime.ts";
import { ledgerBranch, recordLedger, type LedgerSession } from "../../../extensions/context/om/session-ledger/store.ts";
import { foldLedger, recallMemorySources, type Entry, type MemoryDetails } from "../../../extensions/context/om/session-ledger/index.ts";
import { estimateStringTokens } from "../../../extensions/context/om/tokens.ts";
import { db, storePath } from "../../../lib/records/store.ts";

const { values } = parseArgs({ options: {
	session: { type: "string" }, window: { type: "string", default: "64000" }, budget: { type: "string" },
} });
const scratch = mkdtempSync(join(tmpdir(), "om-first-use-"));
const originalStore = storePath();
process.env.PI_BOARD_DIR = scratch;

try {
	if (values.session) {
		const source = new Database(originalStore, { readonly: true });
		try { writeFileSync(join(scratch, "records.db"), source.serialize()); }
		finally { source.close(); }
	}
	mkdirSync(join(scratch, ".pi"));
	writeFileSync(join(scratch, ".pi", "settings.json"), JSON.stringify({
		"observational-memory": DEFAULTS,
		memory: { systems: ["om"], schemas: { om: { compaction: {
			summaryMaxTokens: values.budget ? Number(values.budget) : undefined,
		} } } },
	}));

	let header: { id: string; parentSession?: string } = { id: "om-first-use" };
	let branch: Entry[] = [
		{ id: "source", type: "message", message: { role: "user", content: "Seeded memory source." } },
		{ id: "keep", type: "message", message: { role: "user", content: "Continue after compaction." } },
	];
	if (values.session) {
		const lines = readFileSync(values.session, "utf8").trimEnd().split("\n").map((l) => JSON.parse(l));
		header = lines[0];
		const byId = new Map(lines.slice(1).map((e) => [e.id, e]));
		branch = [];
		for (let e = lines.at(-1); e; e = byId.get(e.parentId)) branch.push(e);
		branch.reverse();
	}
	const sm: LedgerSession = {
		getSessionId: () => header.id, getLeafId: () => branch[0]!.id,
		getBranch: () => branch, getHeader: () => header,
	};
	if (!values.session) {
		const observations = Array.from({ length: 240 }, (_, i) => ({
			id: (i + 1).toString(16).padStart(12, "0"),
			content: "Observed event " + i + ": " + "recent state ".repeat(30),
			timestamp: "2026-10-19 12:00", relevance: "high" as const, sourceEntryIds: ["source"],
			tokenCount: 100,
		}));
		const reflections = Array.from({ length: 300 }, (_, i) => ({
			id: (i + 1000).toString(16).padStart(12, "0"),
			content: "Durable fact " + i + ": " + "stable constraint ".repeat(35),
			supportingObservationIds: [observations[0]!.id], tokenCount: 160,
		}));
		recordLedger(sm, "om.observations.recorded", { observations, coversUpToId: "source" });
		recordLedger(sm, "om.reflections.recorded", { reflections, coversUpToId: "source" });
	}
	const firstKeptEntryId = branch.findLast((e) => e.type === "message" && (e.message as { role?: string })?.role === "user")!.id;
	const hooks = new Map<string, (...args: any[]) => any>();
	registerMechanisms({
		on: (name: string, fn: (...args: any[]) => any) => hooks.set(name, fn),
		events: { on() {} }, registerCommand() {},
	} as any, [compactionMechanism(new Runtime())]);
	const result = await hooks.get("session_before_compact")!({
		preparation: { firstKeptEntryId, tokensBefore: 100000 }, branchEntries: branch,
		signal: new AbortController().signal,
	}, { cwd: scratch, hasUI: false, sessionManager: sm,
		model: Number(values.window) > 0 ? { contextWindow: Number(values.window) } : undefined,
	});
	if (!result?.compaction) throw new Error("OM did not return a compaction");
	const { summary, details } = result.compaction as { summary: string; details: MemoryDetails };
	const ledger = ledgerBranch(sm, branch);
	const full = foldLedger(ledger);
	const omitted = [...details.reflections, ...details.observations].filter((r) => !summary.includes("[" + r.id + "]"));
	const role = details.reflections.find((r) => /persistent top-level.*tend.*supervisor/i.test(r.content));
	console.log(JSON.stringify({
		mode: values.session ? "session snapshot (not a live reload)" : "seeded",
		session: header.id, firstKeptEntryId,
		budget: values.budget ? Number(values.budget) : Number(values.window) > 0 ? Math.floor(Number(values.window) / 8) : 8000,
		summaryTokens: estimateStringTokens(summary),
		storedReflections: full.activeReflections.length, storedObservations: full.activeObservations.length,
		projectedReflections: details.reflections.length, projectedObservations: details.observations.length,
		renderedReflections: details.reflections.filter((r) => summary.includes("[" + r.id + "]")).length,
		renderedObservations: details.observations.filter((r) => summary.includes("[" + r.id + "]")).length,
		omissionLine: summary.split("\n").find((l) => l.includes("omitted to fit")) ?? null,
		omitted: omitted.length, recalledOmissions: omitted.filter((r) => recallMemorySources(ledger, r.id).status === "found").length,
		roleReflection: role?.id ?? null, roleRendered: role ? summary.includes("[" + role.id + "]") : null,
		storageMaxTokens: DEFAULTS.reflectionsPoolMaxTokens, storageTargetTokens: DEFAULTS.reflectionsPoolTargetTokens,
	}, null, 2));
} finally {
	db().close();
	rmSync(scratch, { recursive: true, force: true });
}
