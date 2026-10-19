// Offline first-use setup: real consolidation + compaction paths, scripted worker responses.
// No credentials, network calls, or writes to a live session. Prints results for inspection.
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULTS, resolveCompactionSummaryMaxTokens, resolveReflectionPoolBudget } from "../../../extensions/context/om/config.ts";
import { reflectionPoolTokens } from "../../../extensions/context/om/agents/condenser/agent.ts";
import { runConsolidationPipeline } from "../../../extensions/context/om/hooks/consolidation-trigger.ts";
import { compactionMechanism } from "../../../extensions/context/om/hooks/compaction-hook.ts";
import { Runtime } from "../../../extensions/context/om/runtime.ts";
import { hashId } from "../../../extensions/context/om/ids.ts";
import { foldLedger, renderSummaryWithBudget, type Entry, type Reflection } from "../../../extensions/context/om/session-ledger/index.ts";
import { ledgerBranch, recordLedger, type LedgerSession } from "../../../extensions/context/om/session-ledger/store.ts";
import type { WorkerStreamSimple } from "../../../extensions/context/om/agents/worker-stream.ts";
import { db } from "../../../lib/records/store.ts";

const scratch = mkdtempSync(join(tmpdir(), "om-render-share-"));
process.env.PI_BOARD_DIR = scratch;
const window = Number(process.argv[2] ?? 200_000);
const runtime = new Runtime();
runtime.config = { ...DEFAULTS, observeAfterTokens: Number.MAX_SAFE_INTEGER, reflectAfterTokens: 1 };
runtime.configLoaded = true;
const reflection = (content: string): Reflection => ({
	id: hashId(content), content, supportingObservationIds: ["aaaaaaaaaaaa"], tokenCount: Math.ceil(content.length / 4),
});
const role = reflection("This session is the persistent top-level supervisor for the project.");
const constraint = reflection("Never push the canonical checkout; the parent alone integrates branches.");
const ordinary = Array.from({ length: 120 }, (_, i) => reflection("Completed experiment " + i + ": " + "output was recorded. ".repeat(30)));
const reflections = [role, constraint, ...ordinary];
const observations = Array.from({ length: 140 }, (_, i) => ({
	id: (i + 1).toString(16).padStart(12, "a"),
	content: "Recent event " + i + ": " + "recorded progress. ".repeat(35),
	timestamp: "2026-10-19 12:00", relevance: "high" as const, sourceEntryIds: ["source"], tokenCount: 180,
}));
const branch: Entry[] = [
	{ id: "source", type: "message", message: { role: "user", content: "Begin the fixture." } },
	{ id: "tail", type: "message", message: { role: "user", content: "Continue the current work after observing progress." } },
	{ id: "keep", type: "message", message: { role: "user", content: "What is next?" } },
];
const session: LedgerSession = {
	getSessionId: () => "om-render-share-fixture", getLeafId: () => "source", getBranch: () => branch,
};
const calls: string[] = [];
const streamSimple: WorkerStreamSimple = (model, context) => {
	const condenser = context.messages.some((message) => message.role === "system" && typeof message.content === "string" && message.content.includes("reflection condenser"));
	const merge = condenser && !context.messages.some((message) => message.role === "toolResult");
	calls.push(condenser ? "condenser" : "reflector");
	const message: AssistantMessage = {
		role: "assistant", api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(),
		content: merge ? [{
			type: "toolCall", id: "fixture-merge", name: "merge_reflections",
			arguments: { merges: [{ ids: ordinary.map((r) => r.id), content: "Completed: the experiments recorded their output." }] },
		}] : [{ type: "text", text: "Finished." }],
		stopReason: merge ? "toolUse" : "stop",
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
	};
	const stream = createAssistantMessageEventStream();
	stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
	return stream;
};
// Intentionally larger worker window: budget must follow the session model, not this worker.
runtime.resolveModel = async () => ({ ok: true, model: {
	id: "scripted-worker", provider: "fixture", api: "openai-completions", contextWindow: 1_000_000, maxTokens: 32_000,
} });

try {
	recordLedger(session, "om.observations.recorded", { observations, coversUpToId: "source" });
	recordLedger(session, "om.reflections.recorded", { reflections, coversUpToId: "source" });
	const before = foldLedger(ledgerBranch(session));
	const budget = resolveCompactionSummaryMaxTokens(runtime.config, window);
	const backstop = renderSummaryWithBudget(before.activeReflections, before.activeObservations, { maxTokens: budget });
	await runConsolidationPipeline({} as any, runtime, {
		cwd: scratch, hasUI: false, model: { contextWindow: window }, modelRegistry: { streamSimple }, sessionManager: session,
	});
	const after = foldLedger(ledgerBranch(session));
	const renderer = compactionMechanism(runtime).renderer!;
	const view = { session, branch, firstKeptEntryId: "keep" };
	const summary = renderer.cut(renderer.query(view), budget, view)?.text ?? "";
	console.log(JSON.stringify({
		mode: "offline fixture, scripted memory worker",
		sessionWindow: window, workerWindow: 1_000_000, summaryBudget: budget,
		reflectionBudget: resolveReflectionPoolBudget(runtime.config, window),
		overrides: {
			maxOnly: resolveReflectionPoolBudget({ ...runtime.config, reflectionsPoolMaxTokens: 2000 }, window),
			targetOnly: resolveReflectionPoolBudget({ ...runtime.config, reflectionsPoolTargetTokens: 40_000 }, window),
			both: resolveReflectionPoolBudget({ ...runtime.config, reflectionsPoolMaxTokens: 2000, reflectionsPoolTargetTokens: 600 }, window),
		},
		before: { reflections: before.activeReflections.length, poolTokens: reflectionPoolTokens(before.activeReflections) },
		backstop: {
			omitted: backstop.omittedReflections,
			roleKept: backstop.reflections.some((r) => r.id === role.id),
			constraintKept: backstop.reflections.some((r) => r.id === constraint.id),
			newestOrdinaryKept: backstop.reflections.some((r) => r.id === ordinary.at(-1)!.id),
			oldestOrdinaryKept: backstop.reflections.some((r) => r.id === ordinary[0]!.id),
		},
		workerCalls: calls,
		after: {
			reflections: after.activeReflections.length, poolTokens: reflectionPoolTokens(after.activeReflections),
			roleRendered: summary.includes("[" + role.id + "]"), constraintRendered: summary.includes("[" + constraint.id + "]"),
		},
	}, null, 2));
	if (runtime.lastObserverError || runtime.lastReflectorError || runtime.lastDropperError) throw new Error("Worker failed");
} finally {
	db().close();
	rmSync(scratch, { recursive: true, force: true });
}
