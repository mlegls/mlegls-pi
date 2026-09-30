// Deterministic capacity gate for delegated (non-interactive) work. allocation.json gives each pi
// provider its quota-axi provider and the share of each quota window delegated work may use; the
// rest is held for interactive use over the time left in the window, not the whole window.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Window { id: string; kind: string; percentRemaining: number; timeRemainingPercent?: number | null }
export type Windows = Record<string, Window[]>;
/** `resets`: expiry timestamps of banked full resets (a date alone means that day's start, UTC); delete one once redeemed. */
export type Allocation = Record<string, { quota: string; noninteractive: number; resets?: string[] }>;

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

export interface Gate { admits: boolean; live: boolean; banked: string[] }

/** Whether delegated work may use `model` now: every window that applies to it keeps more than the interactive
 *  reserve scaled by the time left before it resets. Each unexpired banked reset counts as another full window.
 *  `live` says whether the windows pass without the bank. Unknown time counts as the whole window; unknown providers pass. */
export function gate(model: string, current: Windows, alloc = allocation(), now = Date.now()): Gate {
	const provider = model.split("/")[0];
	const entry = alloc[provider];
	if (!entry) return { admits: true, live: true, banked: [] };
	const banked = (entry.resets ?? []).filter(r => Date.parse(r) > now).sort((a, b) => Date.parse(a) - Date.parse(b));
	const name = model.split("/")[1];
	const applicable = (current[provider] ?? []).filter(w => !w.id.startsWith("model:") || name.includes(w.id.slice(6)));
	const passes = (bank: number) => applicable.every(w => w.percentRemaining + 100 * bank > (1 - entry.noninteractive) * (w.timeRemainingPercent ?? 100));
	return { admits: passes(banked.length), live: passes(0), banked };
}

export function admits(model: string, current: Windows, alloc = allocation(), now = Date.now()): boolean {
	return gate(model, current, alloc, now).admits;
}

const notices = () => join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), "mlegls-pi", "reset-notices.json");

/** Tell the human, once per provider and reset, that delegated work is now counting on a banked reset they must redeem. */
export function noticeBankedReset(provider: string, g: Gate, current: Windows, notify = desktop): void {
	if (g.live || !g.banked.length) return;
	const file = notices();
	const seen: Record<string, true> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
	const key = provider + "@" + g.banked[0];
	if (seen[key]) return;
	const left = Math.min(...(current[provider] ?? []).map(w => w.percentRemaining));
	notify(`${provider}: delegated work is past its live share (${left}% left) and is counting on a banked reset. Redeem the one expiring ${g.banked[0]} when the window runs out, then remove it from allocation.json.`);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify({ ...seen, [key]: true }, null, 2));
}

function desktop(text: string) {
	console.error("allocation: " + text);
	try { execFileSync("osascript", ["-e", `display notification ${JSON.stringify(text)} with title "Banked reset needed"`]); } catch {}
}
