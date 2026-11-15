import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export const commitIds = (text: string): string[] => [...new Set(text.match(/\b[0-9a-f]{7,40}\b/g) ?? [])];
export const expandCheckout = (path: string): string => path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
export function containsCommit(cwd: string, commit: string): boolean {
	try {
		execFileSync("git", ["-C", cwd, "rev-parse", "--verify", commit + "^{commit}"], { stdio: "pipe" });
		return true;
	} catch { return false; }
}

/** Keep YAML comments: older handoffs named foreign fixes beside a local commit. */
export function commitDeclarations(handoff: Record<string, unknown>, notes: string[] = []): string {
	return [JSON.stringify(handoff.commit ?? ""), JSON.stringify(handoff.commits ?? ""),
		JSON.stringify(handoff.fixed ?? ""), ...notes].join("\n");
}

export const commitNotes = (report: string): string[] => report.split("\n").filter(line => /^\s*commits?:/.test(line));

/** A checkout qualifies only the commits nested in its mapping. */
export function commitHandoffError(cwd: string, handoff: Record<string, unknown>, report: string): string | undefined {
	const qualified = new Set<string>();
	const visit = (value: unknown) => {
		if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === "object") {
			const entry = value as Record<string, unknown>;
			if (typeof entry.checkout === "string" && isAbsolute(entry.checkout))
				commitIds(commitDeclarations(entry)).forEach(commit => qualified.add(commit));
			Object.values(entry).forEach(visit);
		}
	};
	visit(handoff.commit); visit(handoff.commits); visit(handoff.fixed);
	const bare = commitIds(commitDeclarations(handoff, commitNotes(report)))
		.filter(commit => !qualified.has(commit) && !containsCommit(cwd, commit));
	if (bare.length) return "Foreign commits " + bare.join(", ") +
		" need commit: { checkout: /absolute/loaded/checkout, commits: […] }. Repost the handoff with their loaded checkout.";
}

/** Candidate repositories already named in constraints and handoffs. Git decides
 * whether each candidate is a repository containing the requested object. */
export function namedCheckouts(value: unknown): string[] {
	const paths = new Set<string>();
	const visit = (value: unknown) => {
		if (typeof value === "string") {
			if (isAbsolute(expandCheckout(value))) paths.add(expandCheckout(value));
			for (const match of value.matchAll(/(?:~\/|\/)[^\s"'`,;:{}()[\]<>]+/g))
				paths.add(expandCheckout(match[0].replace(/[.!?]+$/, "")));
		} else if (Array.isArray(value)) value.forEach(visit);
		else if (value && typeof value === "object") Object.values(value).forEach(visit);
	};
	visit(value);
	return [...paths];
}
