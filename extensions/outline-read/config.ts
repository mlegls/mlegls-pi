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
	/** Files per grep call that get anchors and definition context; the rest are listed as path:line. */
	grepAnchorFiles: number;
	/** Model-generated outline for files no structural source supports. */
	fallback: {
		enabled: boolean;
		/** `provider/id` as accepted by `pi --model`. */
		model: string;
		/** Thinking level as accepted by `pi --thinking`. */
		thinking: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	};
	/** Max lines per response for full or ranged reads. */
	maxLines: number;
	/** Max bytes per response for full or ranged reads. */
	maxBytes: number;
}

export const DEFAULT_CONFIG: OutlineReadConfig = {
	thresholdLines: 200,
	minBodyLines: 3,
	budgetTokens: 10_000,
	grepAnchorFiles: 30,
	fallback: { enabled: true, model: "openai-codex/gpt-5.6-luna", thinking: "medium" },
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
	const layers = [readJson(join(getAgentDir(), FILE_NAME)), readJson(join(cwd, ".pi", FILE_NAME))];
	return layers.reduce<OutlineReadConfig>(
		(config, layer) => ({ ...config, ...layer, fallback: { ...config.fallback, ...layer.fallback } }),
		DEFAULT_CONFIG,
	);
}
