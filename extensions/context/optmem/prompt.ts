// optmem's prompt (./prompt.md): UniiChat's (gist §5), one text for turns and compactions, with
// Unii renamed, the paragraph on computers dropped, and the lines that conflict with this harness
// softened: zoom navigates the chat, but recall and other sources stay allowed, and subagent
// policy is left to the rest of the system prompt.
import { readFileSync } from "node:fs";

const TEXT = readFileSync(new URL("./prompt.md", import.meta.url), "utf8").trim();

export const PROMPT = (b: number) => TEXT
	.replace("{groups}", b === 2 ? "adjacent lines are merged in pairs" : "every " + b + " adjacent lines are merged into one")
	.replace("{opens}", b === 2 ? "the two lines" : "the " + b + " lines");

/** A compactor's own system prompt, when it can't share the turns' cache. */
export const COMPACTOR_PROMPT = (b: number) => "You are the compactor of a coding agent's memory.\n\n" + PROMPT(b);
