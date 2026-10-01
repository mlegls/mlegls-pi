/**
 * Stance virtual models: `stance/<agent>` for every agent file with a `model:` list
 * (`provider/model:effort`, most preferred first). Each request goes to the first entry whose
 * provider has credentials and delegated capacity left (allocation.json via quota-axi).
 * Continuations stay on the chosen model so prompt caches hold; a retry after a rate-limit or
 * overload error moves down the list. The virtual thinking level is ignored: the list sets effort.
 */
import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import { readdirSync } from "node:fs";
import { agent, AGENTS_DIR, executions, type Execution } from "../../lib/agents";
import { allocation, gate, noticeBankedReset, windows } from "../../lib/allocation";

export const PROVIDER = "stance";
const EXHAUSTED = /rate.?limit|overload|quota|usage.?limit|capacity|429|529|too many requests/i;

interface State { index: number }

export function stances(): { name: string; list: Execution[] }[] {
	let files: string[] = [];
	try { files = readdirSync(AGENTS_DIR); } catch { return []; }
	return files.filter(f => f.endsWith(".md") && !f.startsWith("_")).flatMap(f => {
		const a = agent(f.slice(0, -3));
		const list = a?.routing ? executions(a.routing) : [];
		return list.length ? [{ name: a!.name, list }] : [];
	});
}

export default function (pi: ExtensionAPI) {
	for (const { name, list } of stances()) {
		pi.registerVirtualModel<State>({
			provider: PROVIDER,
			id: name,
			name: `${name} (stance)`,
			thinkingLevels: ["medium"],
			route(request, ctx) { return route(name, list, request, ctx); },
		});
	}
}

function route(name: string, list: Execution[], request: ModelRouteRequest<State>, ctx: ExtensionContext): ModelRoute<State> {
	const at = (index: number, state?: State): ModelRoute<State> => {
		const e = list[index];
		const [provider, id] = [e.model.slice(0, e.model.indexOf("/")), e.model.slice(e.model.indexOf("/") + 1)];
		return { model: ctx.modelRegistry.find(provider, id)!, thinkingLevel: e.effort as ModelRoute<State>["thinkingLevel"], state };
	};
	const usable = (index: number) => {
		const e = list[index];
		const slash = e.model.indexOf("/");
		const model = ctx.modelRegistry.find(e.model.slice(0, slash), e.model.slice(slash + 1));
		return !!model && ctx.modelRegistry.hasConfiguredAuth(model);
	};
	const current = request.state?.index;
	if (request.reason === "continuation" && current !== undefined) return at(current);
	if (request.reason === "retry" && current !== undefined) {
		const error = request.failed?.message.errorMessage ?? "";
		if (!EXHAUSTED.test(error)) return at(current);
		for (let i = current + 1; i < list.length; i++) if (usable(i)) return at(i, { index: i });
		throw new Error(`stance/${name}: ${list[current].model} failed (${error}) and no later entry is usable`);
	}
	if (request.reason === "direct") {
		// Compaction and other out-of-loop calls: the session's model if chosen, else the first usable.
		if (current !== undefined) return at(current);
		const i = list.findIndex((_, i) => usable(i));
		if (i < 0) throw new Error(`stance/${name}: no entry has credentials`);
		return at(i);
	}
	// A new user turn: keep the current model while it still has capacity, else re-select.
	const alloc = allocation();
	const now = windows(alloc);
	const admits = (i: number) => {
		if (!usable(i)) return false;
		const g = gate(list[i].model, now, alloc);
		if (g.admits) noticeBankedReset(list[i].model.split("/")[0], g, now);
		return g.admits;
	};
	if (current !== undefined && admits(current)) return at(current);
	const i = list.findIndex((_, i) => admits(i));
	if (i < 0) throw new Error(`stance/${name}: no model in the list has delegated capacity left`);
	return at(i, { index: i });
}
