// Groups the proxy's TrackerSnapshot / TrackerIssues / TrackerLabels / TrackerConnection requests into the logical
// snapshot refreshes that produced them. A refresh is synchronous inside one process: its first request is
// TrackerSnapshot and the cursor pages that follow come from the same parent process before it starts another.
export const trackerRead = /^Tracker(Snapshot|Issues|Labels|Connection)$/;
export const pageSize = 100;

export interface Refresh { at: string; ppid: number; requests: number; operations: Record<string, number>; success: boolean;
	issues: { unique: number; total: number; complete: boolean } }

export function refreshes(calls: any[]): { rows: Refresh[]; orphanPages: number } {
	const out: (Refresh & { ids: Set<string>; last?: any })[] = [], open = new Map<number, (typeof out)[number]>();
	let orphanPages = 0;
	for (const c of calls) {
		if (!trackerRead.test(c.operation)) continue;
		let r = open.get(c.ppid);
		if (c.operation === "TrackerSnapshot") {
			r = { at: c.at, ppid: c.ppid, requests: 0, operations: {}, success: true, issues: { unique: 0, total: c.totalCount ?? -1, complete: false }, ids: new Set() };
			out.push(r); open.set(c.ppid, r);
		} else if (!r) { orphanPages++; continue; }
		r.requests++; r.operations[c.operation] = (r.operations[c.operation] ?? 0) + 1;
		r.success &&= c.status === 0;
		if (c.kind === "issues") { for (const id of c.ids ?? []) r.ids.add(id); r.last = c; }
	}
	return { orphanPages, rows: out.map(({ ids, last, ...r }) => ({ ...r,
		issues: { ...r.issues, unique: ids.size, complete: r.success && last?.more === false && ids.size === r.issues.total } })) };
}
/** The fewest requests a complete refresh of this many issues can take: one per hundred-node page. */
export const minimumRequests = (total: number) => Math.max(1, Math.ceil(total / pageSize));
export function summarize(calls: any[]) {
	const { rows, orphanPages } = refreshes(calls), requestsPerRefresh: Record<string, number> = {};
	for (const r of rows) requestsPerRefresh[r.requests] = (requestsPerRefresh[r.requests] ?? 0) + 1;
	return { refreshes: rows.length, requestsPerRefresh, totalRequests: rows.reduce((n, r) => n + r.requests, 0), orphanPages,
		allComplete: rows.every(r => r.issues.complete),
		// Exactly the repository-page requests: one TrackerSnapshot plus ceil(issues/100)-1 TrackerIssues cursor pages, nothing per issue.
		allMinimal: rows.every(r => r.requests === minimumRequests(r.issues.total) && Object.keys(r.operations).every(o => o === "TrackerSnapshot" || o === "TrackerIssues")),
		maxIssues: Math.max(0, ...rows.map(r => r.issues.unique)) };
}
