// One subject across places and time; the same memory grammar for turns and compactions.
import { readFileSync } from "node:fs";

const TEXT = readFileSync(new URL("./prompt.md", import.meta.url), "utf8").trim();

export const PROMPT = (b: number) => TEXT
	.replace("{groups}", b === 2 ? "adjacent lines are merged in pairs" : "every " + b + " adjacent lines are merged into one")
	.replace("{opens}", b === 2 ? "the two lines" : "the " + b + " lines");

/** Own prompt for a compactor that can't share the turn's cache. */
export const COMPACTOR_PROMPT = (b: number) => "You write this agent's memory, one line at a time.\n\n" +
	PROMPT(b).replace(/\n## Turns\n[\s\S]*?(?=\n## )/, "\n");
