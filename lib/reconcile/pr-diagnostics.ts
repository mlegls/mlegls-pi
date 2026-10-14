import { execFileSync } from "node:child_process";
import type { ReportedCheck } from "./pr-types.ts";

/** GitHub Actions' check summaries often omit failing paths. Fetch the failed-job
 * excerpts for heldByRed and the repair prompt; transport failure must not look green.
 * Injected hosts supply their own diagnostic text, so scratch hosts never call gh. */
export function failedCheckDiagnostics(cwd: string, repository: string, checks: ReportedCheck[], injected: boolean): ReportedCheck[] {
	const failures = checks.filter(check => check.state === "fail");
	if (injected) return failures;
	const logs = new Map<string, string>();
	return failures.map(check => {
		const url = check.url && new URL(check.url);
		const match = url && /^(\/[^/]+\/[^/]+)\/actions\/runs\/(\d+)(?:\/|$)/.exec(url.pathname);
		if (!match || url.hostname !== "github.com" || match[1].slice(1).toLowerCase() !== repository.toLowerCase()) return check;
		const id = match[2];
		if (!logs.has(id)) logs.set(id, execFileSync("gh", ["run", "view", id, "--repo", repository, "--log-failed"], {
			cwd, encoding: "utf8", stdio: "pipe", timeout: 60_000, maxBuffer: 64 << 20,
		}).slice(-24_000));
		return { ...check, details: [check.details, logs.get(id)].filter(Boolean).join("\n") };
	});
}
