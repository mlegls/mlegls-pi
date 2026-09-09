import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface OutlineReadConfig {
	/** Files with at most this many lines are returned in full. */
	thresholdLines: number;
	/** Bodies shorter than this stay inline. */
	minBodyLines: number;
	/** Outline level rises until the output is under this many tokens. */
	budgetTokens: number;
	/** Model for the fallback outline, as `provider/id[:thinking]`. */
	fallbackModel: string;
	/** Max lines per response for full or ranged reads. */
	maxLines: number;
	/** Max bytes per response for full or ranged reads. */
	maxBytes: number;
}

export const DEFAULT_CONFIG: OutlineReadConfig = {
	thresholdLines: 200,
	minBodyLines: 3,
	budgetTokens: 10_000,
	fallbackModel: "openai-codex/chatgpt-5.6-luna:medium",
	maxLines: 2000,
	maxBytes: 50 * 1024,
};

const FILE_NAME = "outline-read.json";

function readJson(path: string): Partial<OutlineReadConfig> {
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		console.warn(`[outline-read] ignoring invalid ${path}: ${error instanceof Error ? error.message : error}`);
		return {};
	}
}

/** Global `~/.pi/agent/outline-read.json` overridden by `<cwd>/.pi/outline-read.json`. */
export function loadConfig(cwd: string): OutlineReadConfig {
	return {
		...DEFAULT_CONFIG,
		...readJson(join(getAgentDir(), FILE_NAME)),
		...readJson(join(cwd, ".pi", FILE_NAME)),
	};
}
