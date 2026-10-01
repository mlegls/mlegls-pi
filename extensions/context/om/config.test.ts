import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.js";

const cwd = mkdtempSync(join(tmpdir(), "om-config-"));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

test("memory.schemas.om maps onto upstream keys and overrides the legacy key", () => {
	mkdirSync(join(cwd, ".pi"));
	writeFileSync(join(cwd, ".pi", "settings.json"), JSON.stringify({
		"observational-memory": { observeAfterTokens: 1, reflectAfterTokens: 2 },
		memory: { schemas: { om: {
			model: { provider: "p", id: "m", thinking: "low" },
			observer: { afterTokens: 111, chunkMaxTokens: 5000 },
			dropper: { targetTokens: 300 },
			agent: { maxTurns: 4, maxTokens: 900 },
			compaction: { afterTokens: 50000, mode: "ratio", ratio: 0.4 },
			budget: 600,
		} } },
	}));
	const c = loadConfig(cwd, {});
	expect(c).toMatchObject({
		model: { provider: "p", id: "m", thinking: "low" },
		observeAfterTokens: 111, observerChunkMaxTokens: 5000, reflectAfterTokens: 2,
		observationsPoolTargetTokens: 300, observationsPoolMaxTokens: 600,
		agentMaxTurns: 4, agentMaxTokens: 900,
		compactAfterTokens: 50000, compactAfterTokensMode: "ratio", compactAfterTokensRatio: 0.4,
	});
});
