// Offline library drive: isolated ledger/debug files, scripted Jev, no provider credentials.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { compactionMechanism } from "../../../extensions/context/om/hooks/compaction-hook.ts";
import { Runtime } from "../../../extensions/context/om/runtime.ts";
import { fixtureReflections, fixtureObservations } from "../../../extensions/context/om/hooks/rank-reflections.fixture.ts";
import { render } from "../../../lib/records/render.ts";
import { debugLogRelativePath } from "../../../extensions/context/om/debug-log.ts";
import type { MemoryDetails } from "../../../extensions/context/om/session-ledger/types.ts";

mkdirSync(".wm", { recursive: true });
const dir = mkdtempSync(join(process.cwd(), ".wm/compaction-"));
process.env.PI_BOARD_DIR = join(dir, "store");
process.env.PI_CODING_AGENT_DIR = join(dir, "agent");
const reflections = fixtureReflections.map((r) => ({ ...r,
	id: createHash("sha256").update(r.id).digest("hex").slice(0, 12), supportingObservationIds: ["aaaaaaaaaaaa"],
}));
const observations = fixtureObservations.map((o) => ({ ...o, id: "aaaaaaaaaaaa", sourceEntryIds: ["m1"] }));
const branch = [
	{ id: "m1", type: "message" },
	{ id: "o1", type: "custom", customType: "om.observations.recorded", data: { observations, coversUpToId: "m1" } },
	{ id: "r1", type: "custom", customType: "om.reflections.recorded", data: { reflections, coversUpToId: "m1" } },
	{ id: "m2", type: "message" },
];
const session = {
	getSessionId: () => "compaction-ranking-smoke", getSessionFile: () => undefined,
	getLeafId: () => "m2", getBranch: () => branch,
};
const runtime = new Runtime();
runtime.configLoaded = true;
Object.assign(runtime.config, { compactionSummaryMaxTokens: 600, observationsPoolMaxTokens: 1, debugLog: true });
const mechanism = compactionMechanism(runtime);
const event = { branchEntries: branch, preparation: { firstKeptEntryId: "m2" }, signal: new AbortController().signal };
let calls = 0;
const model = { provider: "typesafe", id: "jev-latest" };
const registry = {
	getAvailableOfType: async () => { calls++; return [model]; },
	classify: async () => ({
		api: "typesafe", provider: "typesafe", model: "jev-latest", stopReason: "stop", timestamp: Date.now(),
		answers: Object.fromEntries(reflections.flatMap((_, i) => [
			[`preserve_${i}`, { type: "bool", probability: i < 2 ? 1 : 0 }],
			[`relevance_${i}`, { type: "score", score: 1, confidence: 1 }],
		])),
	}),
};
const ctx = { cwd: process.cwd(), sessionManager: session, modelRegistry: registry };
try {
	let prepared = await mechanism.prepare!(event as never, ctx as never);
	const section = render(mechanism.renderer!, { session, branch, firstKeptEntryId: "m2", prepared }, 600)!;
	assert(section.text.includes(reflections[0].content));
	assert.equal((section.details as MemoryDetails).reflections.length, 14);
	assert.equal(calls, 1);
	console.log("overflow: ranked role retained; all 14 reflections retained in details");
	runtime.config.compactionSummaryMaxTokens = 10000;
	prepared = await mechanism.prepare!(event as never, ctx as never);
	assert.equal(prepared, undefined);
	assert.equal(calls, 1);
	console.log("fits: no credential lookup or Jev call");
	runtime.config.compactionSummaryMaxTokens = 600;
	const modes = {
		missing: { getAvailableOfType: async () => [], classify: async () => { throw Error("must not call"); } },
		error: { ...registry, classify: async () => { throw Error("scripted failure"); } },
		timeout: { ...registry, getAvailableOfType: async () => new Promise(() => {}) },
	};
	for (const [mode, modelRegistry] of Object.entries(modes)) {
		const started = Date.now();
		prepared = await mechanism.prepare!(event as never, { ...ctx, modelRegistry } as never);
		assert.deepEqual(prepared!.reflectionOrder, reflections.map((r) => r.id).reverse());
		console.log(`${mode}: newest-first in ${Date.now() - started}ms`);
	}
	const logs = readFileSync(join(dir, "agent", debugLogRelativePath({ sessionId: session.getSessionId() })), "utf8")
		.trim().split("\n").map((line) => JSON.parse(line));
	assert.equal(logs.filter((l) => l.event === "reflection_rank.fallback").length, 3);
	assert(logs.filter((l) => l.event === "reflection_rank.fallback").every((l) => l.sessionId === session.getSessionId()));
	console.log("debug: ranked event plus three session-scoped fallback events");
} finally {
	rmSync(dir, { recursive: true, force: true });
}
