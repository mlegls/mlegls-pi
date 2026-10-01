// OM's compaction renderer: query = the branch with the om ledger spliced in, cut = the
// compaction projection with budget = observationsPoolMaxTokens (at or past it, reflections
// and drops are folded in; below, the stable prefix is kept), rendered as upstream's summary.
// extensions/context/compaction.ts composes it with other mechanisms' renderers.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Renderer } from "../../../../lib/records/render.ts";
import type { CompactionMechanism, CompactionView } from "../../compaction.ts";
import { ledgerBranch, type LedgerSession } from "../session-ledger/store.js";

import type { Runtime } from "../runtime.js";
import { buildCompactionProjection, renderSummary, type Entry } from "../session-ledger/index.js";

const DEFAULT_OBSERVATIONS_POOL_MAX_TOKENS = 20_000;

function observationsPoolMaxTokens(runtime: Runtime): number {
	const value = (runtime.config as { observationsPoolMaxTokens?: unknown }).observationsPoolMaxTokens;
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: DEFAULT_OBSERVATIONS_POOL_MAX_TOKENS;
}

export const omRenderer: Renderer<CompactionView, Entry[]> = {
	name: "om",
	role: "memory",
	query: (view) => ledgerBranch(view.session as LedgerSession, view.branch as Entry[]),
	cut(entries, budget, view) {
		const projection = buildCompactionProjection(entries, view.firstKeptEntryId, { observationsPoolMaxTokens: budget });
		const text = renderSummary(projection.reflections, projection.observations);
		return text ? { text, details: projection.details } : undefined;
	},
};

export function compactionMechanism(runtime: Runtime): CompactionMechanism {
	return {
		renderer: omRenderer,
		budget: () => observationsPoolMaxTokens(runtime),
		enabled(ctx: ExtensionContext) {
			runtime.ensureConfig(ctx.cwd);
			return runtime.config.passive !== true;
		},
		begin(ctx: ExtensionContext) {
			if (runtime.compactHookInFlight) return false;
			runtime.compactHookInFlight = true;
			runtime.ensureConfig(ctx.cwd);
			return true;
		},
		end() {
			runtime.compactHookInFlight = false;
		},
	};
}
