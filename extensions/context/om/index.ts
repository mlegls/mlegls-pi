// Vendored from pi-observational-memory 3.1.4 (MIT, elpapi42; see ./LICENSE).
// Changes from upstream: the ledger lives in the records store as schema `om`
// (session-ledger/store.ts) instead of custom session entries, and the worker agents pass
// their system prompt as a system message (pi-agent-core 0.99 dropped context.systemPrompt),
// and the compaction hook is a renderer composed by extensions/context/compaction.ts.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerStatusCommand } from "./commands/status.js";
import { registerViewCommand } from "./commands/view.js";
import { compactionMechanism } from "./hooks/compaction-hook.js";
import type { CompactionMechanism } from "../compaction.ts";
import { registerCompactionTrigger } from "./hooks/compaction-trigger.js";
import { registerConsolidationTrigger } from "./hooks/consolidation-trigger.js";
import { Runtime } from "./runtime.js";
import { registerRecallTool } from "./tools/recall-observation.js";

/** Registers OM's triggers, commands and tools; returns its compaction renderer for extensions/context to compose. */
export default function observationalMemory(pi: ExtensionAPI): CompactionMechanism {
	const runtime = new Runtime();

	registerConsolidationTrigger(pi, runtime);
	registerCompactionTrigger(pi, runtime);

	registerStatusCommand(pi, runtime);
	registerViewCommand(pi, runtime);
	registerRecallTool(pi);
	return compactionMechanism(runtime);
}
