// One named TrackerSnapshot per refresh. Obsolete cursor operations remain counted
// so any accidental fallback is a failing measurement, not an invisible extra request.
export const trackerRead = /^Tracker(Snapshot|Issues|Labels|Connection)$/;

export interface Refresh { at: string; ppid: number; requests: number; operations: Record<string, number>; success: boolean;
	issues: { unique: number; total: number; complete: boolean }; connections?: { checked: number; complete: number; incomplete: unknown[] } }

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
		if (c.connections) r.connections = c.connections;
		if (c.kind === "issues") { for (const id of c.ids ?? []) r.ids.add(id); r.last = c; }
	}
	return { orphanPages, rows: out.map(({ ids, last, ...r }) => ({ ...r,
		issues: { ...r.issues, unique: ids.size, complete: r.success && last?.more === false && ids.size === r.issues.total } })) };
}
export function summarize(calls: any[]) {
	const { rows, orphanPages } = refreshes(calls), requestsPerRefresh: Record<string, number> = {};
	for (const r of rows) requestsPerRefresh[r.requests] = (requestsPerRefresh[r.requests] ?? 0) + 1;
	return { refreshes: rows.length, requestsPerRefresh, totalRequests: rows.reduce((n, r) => n + r.requests, 0), orphanPages,
		allComplete: rows.every(r => r.issues.complete && r.connections && r.connections.checked === r.connections.complete),
		allSingleRequest: rows.every(r => r.requests === 1 && Object.keys(r.operations).every(o => o === "TrackerSnapshot")),
		maxIssues: Math.max(0, ...rows.map(r => r.issues.unique)) };
}
