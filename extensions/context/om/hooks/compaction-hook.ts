// OM's compaction renderer: query = the branch with the om ledger spliced in, cut = the
// compaction projection folds reflections and drops at observationsPoolMaxTokens (below it,
// the stable prefix is kept). The independent render budget limits context, not stored memory.
// extensions/context/mechanism.ts composes it with other mechanisms' renderers.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Renderer } from "../../../../lib/records/render.ts";
import type { Mechanism, CompactionView } from "../../mechanism.ts";
import { ledgerBranch, type LedgerSession } from "../session-ledger/store.js";

import type { Runtime } from "../runtime.js";
import { resolveCompactionSummaryMaxTokens } from "../config.js";
import { buildCompactionProjection, renderSummaryWithBudget, type Entry } from "../session-ledger/index.js";

const DEFAULT_OBSERVATIONS_POOL_MAX_TOKENS = 20_000;

function observationsPoolMaxTokens(runtime: Runtime): number {
	const value = (runtime.config as { observationsPoolMaxTokens?: unknown }).observationsPoolMaxTokens;
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: DEFAULT_OBSERVATIONS_POOL_MAX_TOKENS;
}

function createOmRenderer(poolMaxTokens: () => number): Renderer<CompactionView, Entry[]> {
	return {
		name: "om",
		role: "memory",
		query: (view) => ledgerBranch(view.session as LedgerSession, view.branch as Entry[]),
		cut(entries, budget, view) {
			const projection = buildCompactionProjection(entries, view.firstKeptEntryId, { observationsPoolMaxTokens: poolMaxTokens() });
			const rendered = renderSummaryWithBudget(projection.reflections, projection.observations, { maxTokens: budget });
			// Keep the complete projection in details: omitted lines remain recallable and can
			// still recover the ledger's ancestry after a bb rewind/continuation.
			return rendered.text ? { text: rendered.text, details: projection.details } : undefined;
		},
	};
}

export const omRenderer = createOmRenderer(() => DEFAULT_OBSERVATIONS_POOL_MAX_TOKENS);

export function compactionMechanism(runtime: Runtime): Mechanism {
	return {
		renderer: createOmRenderer(() => observationsPoolMaxTokens(runtime)),
		budget: (ctx) => resolveCompactionSummaryMaxTokens(runtime.config, ctx.model?.contextWindow),
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
