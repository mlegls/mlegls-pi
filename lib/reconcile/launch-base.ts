import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { git, isAncestor } from "./checks.ts";
import { mergeTree } from "./landing.ts";
import type { CollectorRecord, LandingLedger } from "./tracker-state.ts";

interface LedgerSource { landed?: LandingLedger; collectors?: Record<string, CollectorRecord> }
export interface LaunchRequirement {
	name: string;
	head: string;
	/** For a recorded checkout this is HEAD; otherwise a kept branch or a pinned revision. */
	ref: string;
	checkout?: string;
}
export interface LaunchConflict {
	base: string;
	requirement: LaunchRequirement;
	sourceHead: string;
	files: string[];
}

/** Keep the latest receipt for each recorded blocker, including landings by other roots. */
export function landedRequirements(dir: string, root: string, own: LedgerSource, blockers: string[]): LaunchRequirement[] {
	if (!blockers.length) return [];
	const ledgers: LedgerSource[] = [own];
	for (const f of readdirSync(dir)) {
		if (/^[^.]+\.json$/.test(f) && f !== root + ".json") ledgers.push(JSON.parse(readFileSync(join(dir, f), "utf8")));
	}
	return blockers.flatMap(name => {
		let found: (LaunchRequirement & { at: string }) | undefined;
		for (const ledger of ledgers) {
			const landing = ledger.landed?.[name];
			if (!landing || found && found.at >= landing.at) continue;
			const col = ledger.collectors?.[landing.into];
			const checkout = col?.path ?? (isAbsolute(landing.into) ? landing.into : undefined);
			found = { name, head: landing.head, at: landing.at, ...(checkout && existsSync(checkout)
				? { ref: "HEAD", checkout } : { ref: col ? "refs/heads/" + col.branch : landing.head }) };
		}
		return found ? [found] : [];
	});
}

export function commitRef(cwd: string, ref: string): string | undefined {
	try { return git(cwd, "rev-parse", "--verify", "-q", "--end-of-options", ref + "^{commit}"); }
	catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
}

export const conflictKey = (base: string, head: string) => base + ":" + head;

/** Check exact ancestry, fast-forward where possible, and synthesize a commit only for a clean two-parent merge. */
export function advanceLaunchBase(cwd: string, base: string, requirements: LaunchRequirement[], waived: string[] = []): { base: string } | LaunchConflict {
	for (const requirement of requirements) {
		const { head, ref, checkout, name } = requirement;
		if (waived.includes(conflictKey(base, head)) || isAncestor(cwd, head, base)) continue;
		const tip = commitRef(checkout ?? cwd, ref);
		// A retired checkout or rewritten ref can no longer supply the recorded work. The receipt still pins it.
		const sourceHead = tip && isAncestor(cwd, head, tip) ? tip : head;
		if (isAncestor(cwd, base, sourceHead)) { base = sourceHead; continue; }
		const merge = mergeTree(cwd, base, sourceHead);
		if ("files" in merge) return { base, requirement, sourceHead, files: merge.files };
		// Replaying the same inputs must give the same base for a later requirement's conflict/waiver.
		const date = "@" + git(cwd, "show", "-s", "--format=%ct", sourceHead) + " +0000";
		base = execFileSync("git", ["-C", cwd, "-c", "commit.gpgsign=false", "commit-tree", merge.tree,
			"-p", base, "-p", sourceHead, "-m", "Advance reconciler base for " + name], {
			encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
		}).trim();
	}
	return { base };
}
