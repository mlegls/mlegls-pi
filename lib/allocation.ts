// Deterministic capacity gate for delegated (non-interactive) work. allocation.json gives each
// provider its quota-axi provider and the share of each quota window delegated work may use; the
// rest is held for interactive use over the time left in the window, not the whole window.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { codexAuth, redeemReset, resetCredits, type ResetCredit } from "./codex-resets";

export interface Window {
	id: string; kind: string; percentRemaining: number; timeRemainingPercent?: number | null;
	resetsAt?: string; accountId?: string; stale?: boolean; reused?: boolean; refreshedAt?: string;
}
export type Windows = Record<string, Window[]>;
export type Allocation = Record<string, { quota: string; noninteractive: number }>;

export function allocation(path = new URL("../allocation.json", import.meta.url)): Allocation {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** Current quota windows by execution provider, from quota-axi (readings reused up to a minute). */
export function windows(alloc = allocation(), fresh = false): Windows {
	const quotas = [...new Set(Object.values(alloc).map(a => a.quota))];
	let report: { providers?: { provider: string; account?: { accountId?: string }; state?: { stale?: boolean; reused?: boolean; refreshedAt?: string }; windows?: (Omit<Window, "percentRemaining"> & { percentRemaining?: number; pace?: { timeRemainingPercent?: number } })[] }[] };
	try {
		report = JSON.parse(execFileSync("quota-axi", ["--full", "--json", ...(fresh ? [] : ["--max-age", "60s"]), "--provider", quotas.join(",")], { encoding: "utf8", timeout: 30_000 }));
	} catch (error) {
		console.error("allocation: quota-axi unreadable; treating capacity as unknown: " + (error as Error).message.split("\n")[0]);
		return {};
	}
	const byQuota = new Map((report.providers ?? []).map(p => [p.provider, (p.windows ?? [])
		.filter(w => w.kind !== "credits" && typeof w.percentRemaining === "number")
		.map(w => ({ id: w.id, kind: w.kind, percentRemaining: w.percentRemaining!, timeRemainingPercent: w.pace?.timeRemainingPercent ?? null,
			resetsAt: w.resetsAt, accountId: p.account?.accountId, stale: p.state?.stale, reused: p.state?.reused, refreshedAt: p.state?.refreshedAt }))]));
	return Object.fromEntries(Object.entries(alloc).flatMap(([provider, { quota }]) => byQuota.has(quota) ? [[provider, byQuota.get(quota)!]] : []));
}

export interface Gate { admits: boolean; live: boolean; banked: ResetCredit[]; exhausted: Window[] }

/** Unexpired credits count as deferred capacity. An exhausted window needs a successful reset
 *  before that capacity can be used; below the interactive reserve but above zero, it can wait. */
export function gate(model: string, current: Windows, alloc = allocation(), credits: ResetCredit[] = [], now = Date.now()): Gate {
	const [provider, name] = model.split("/");
	const entry = alloc[provider];
	if (!entry) return { admits: true, live: true, banked: [], exhausted: [] };
	const applicable = (current[provider] ?? []).filter(w => {
		if (entry.quota === "codex" && w.id.startsWith("code_review_")) return false;
		return !w.id.startsWith("model:") || !!name?.includes(w.id.split(":")[1]);
	});
	const exhausted = applicable.filter(w => w.percentRemaining === 0);
	const banked = credits.filter(c => c.expiresAt > now).sort((a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id));
	const passes = (bank: number) => applicable.every(w => w.percentRemaining + 100 * bank > (1 - entry.noninteractive) * (w.timeRemainingPercent ?? 100));
	return { admits: !exhausted.length && passes(banked.length), live: passes(0), banked, exhausted };
}

/** Evaluate a usable route when work asks for it. Previewing capacity uses gate(), which has no side effects. */
export async function capacity(model: string, current: Windows, alloc = allocation(), redeem = true): Promise<{ admits: boolean; redeemed: boolean }> {
	let g = gate(model, current, alloc);
	const provider = model.split("/")[0];
	const entry = alloc[provider];
	const deny = { admits: false, redeemed: false };
	if (entry?.quota === "codex" && redeem && g.exhausted.some(w => w.reused)) {
		// A cached zero might predate an account reset performed elsewhere.
		current = windows({ [provider]: entry }, true);
		if (!current[provider]?.length || current[provider].every(w => w.stale)) return deny;
		g = gate(model, current, alloc);
	}
	if (g.live || entry?.quota !== "codex") return { admits: g.admits, redeemed: false };
	if (g.exhausted.length && !redeem) return deny;
	const auth = codexAuth();
	if (!auth || !(current[provider] ?? []).some(w => w.accountId === auth.accountId)) return deny;
	if (!g.exhausted.length) {
		return { admits: gate(model, current, alloc, await resetCredits(auth)).admits, redeemed: false };
	}
	const now = Date.now();
	const exhausted = g.exhausted.map(w => ({ id: w.id, resetsAt: Date.parse(w.resetsAt ?? ""), refreshedAt: Date.parse(w.refreshedAt ?? "") }))
		.sort((a, b) => Number(a.id.startsWith("model:")) - Number(b.id.startsWith("model:")) || b.resetsAt - a.resetsAt || a.id.localeCompare(b.id));
	if (g.exhausted.some(w => w.stale || w.reused || w.accountId !== auth.accountId) || !exhausted.every(w => w.resetsAt > now)) return deny;
	const { banked } = gate(model, current, alloc, await resetCredits(auth));
	if (!exhausted.every(w => w.resetsAt > Date.now())) return deny;
	const result = await redeemReset(auth, exhausted, banked[0]);
	return { admits: !!result, redeemed: result === "reset" };
}
