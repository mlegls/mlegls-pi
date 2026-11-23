import { executions, type Agent } from "./agents";
import { allocation, capacity, windows } from "./allocation";
import { bbModels, bbProject, bbProviders } from "./thread/bb";
import { checkout } from "./thread/git";
import type { WorkerExecution, WorkerRoute } from "./thread/types";

const prefix = (model: string) => model.slice(0, model.indexOf("/"));

/** Resolve at a worker boundary. A pure Pi stance can still route and fall back inside its own session. */
export async function workerExecution({ agent, model, effort, after, project }: {
	agent?: Agent; model?: string; effort?: string; after?: WorkerRoute; project: string;
}): Promise<WorkerExecution> {
	const virtual = agent && (!model || model === "stance/" + agent.name);
	const entries = virtual && agent.routing ? executions(agent.routing) : [];
	// A retry cursor names an execution; repeated copies of it cannot be separate fallbacks.
	const list = entries.filter((e, i) => entries.findIndex(p => p.model === e.model && p.effort === e.effort) === i);
	if (!list.length && !after && virtual) return { providerId: "pi", model: "stance/" + agent.name, effort: effort ?? "medium" };
	if (!list.length && (!model?.includes("/") || !effort)) throw new Error("wm.spawn requires an agent, or a model (provider/model) and effort");
	const providers = new Map((await bbProviders()).map(p => [p.id, p]));
	const native = (id: string) => providers.has(id) || id === "codex" || id === "claude-code" || id === "pi" || id.startsWith("acp-");
	const split = (m: string) => native(prefix(m)) ? { providerId: prefix(m), model: m.slice(m.indexOf("/") + 1) } : { providerId: "pi", model: m };
	const available = (id: string) => {
		const p = providers.get(id);
		return p?.available && p.enabled !== false && p.pluginEnabled !== false;
	};
	if (!after && list.length && list.every(e => !native(prefix(e.model))))
		return { providerId: "pi", model: "stance/" + agent!.name, effort: effort ?? "medium" };
	if (!after && !list.length) {
		const target = split(model!);
		if (target.providerId !== "pi" && !available(target.providerId)) throw new Error("BB provider unavailable: " + target.providerId);
		return { ...target, effort };
	}
	const failed = after ? list.findIndex(e => after.agent === agent?.name && e.model === after.model && e.effort === after.effort) : -1;
	const alloc = allocation();
	const retryCodex = failed >= 0 && alloc[prefix(list[failed].model)]?.quota === "codex";
	const current = windows(alloc, retryCodex);
	for (const [i, e] of list.entries()) {
		if ((after && failed < 0) || i < failed || (i === failed && !retryCodex)) continue;
		const target = split(e.model);
		if (!available(target.providerId)) continue;
		const catalog = await bbModels(target.providerId, await bbProject(checkout(project).project), target.model).catch(() => []);
		const match = catalog.find(m => m.id === target.model || m.model === target.model);
		if (!match || (match.supportedReasoningEfforts?.length && !match.supportedReasoningEfforts.some(r => r.reasoningEffort === e.effort))) continue;
		const room = await capacity(e.model, current, alloc);
		// Reuse a failed route only if this launch actually freed new capacity there.
		if (i === failed ? !room.redeemed : !room.admits) continue;
		return { ...target, effort: e.effort, route: { agent: agent!.name, ...e } };
	}
	throw new Error(`${agent?.name ?? "worker"}: no ${after ? "later " : ""}model has delegated capacity and is available in BB`);
}
