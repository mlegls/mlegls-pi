// Deterministic capacity gate for delegated (non-interactive) work. allocation.json gives each pi
// provider its quota-axi provider and the share of each quota window delegated work may use; the
// rest is held for interactive use over the time left in the window, not the whole window.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export interface Window { id: string; kind: string; percentRemaining: number; timeRemainingPercent?: number | null }
export type Windows = Record<string, Window[]>;
type Allocation = Record<string, { quota: string; noninteractive: number }>;

export function allocation(path = new URL("../allocation.json", import.meta.url)): Allocation {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** Current quota windows by pi provider, from quota-axi (readings reused up to a minute). Unreadable providers are absent. */
export function windows(alloc = allocation()): Windows {
	const byQuota = Object.fromEntries(Object.entries(alloc).map(([pi, a]) => [a.quota, pi]));
	let report: { providers?: { provider: string; windows?: { id: string; kind: string; percentRemaining?: number; pace?: { timeRemainingPercent?: number } }[] }[] };
	try {
		report = JSON.parse(execFileSync("quota-axi", ["--full", "--json", "--max-age", "60s", "--provider", Object.keys(byQuota).join(",")], { encoding: "utf8", timeout: 30_000 }));
	} catch (error) {
		console.error("allocation: quota-axi unreadable; treating capacity as unknown: " + (error as Error).message.split("\n")[0]);
		return {};
	}
	return Object.fromEntries((report.providers ?? []).filter(p => byQuota[p.provider] && p.windows?.length).map(p => [byQuota[p.provider],
		p.windows!.filter(w => w.kind !== "credits" && typeof w.percentRemaining === "number")
			.map(w => ({ id: w.id, kind: w.kind, percentRemaining: w.percentRemaining!, timeRemainingPercent: w.pace?.timeRemainingPercent ?? null }))]));
}

/** Whether delegated work may use `model` now: every window that applies to it keeps more than the interactive
 *  reserve scaled by the time left before it resets. Unknown time counts as the whole window; unknown providers pass. */
export function admits(model: string, current: Windows, alloc = allocation()): boolean {
	const provider = model.split("/")[0];
	const share = alloc[provider]?.noninteractive;
	if (share === undefined) return true;
	const name = model.split("/")[1];
	return (current[provider] ?? []).filter(w => !w.id.startsWith("model:") || name.includes(w.id.slice(6)))
		.every(w => w.percentRemaining > (1 - share) * (w.timeRemainingPercent ?? 100));
}
