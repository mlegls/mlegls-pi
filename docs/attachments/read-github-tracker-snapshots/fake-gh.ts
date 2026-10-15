// Fixture GraphQL server for reader.ts: pages complete plain-array repository data by cursor,
// like GitHub's first:N/after connections. totals overrides a declared totalCount
// ("issues", "labels" or "<connection>:<issue number>") to simulate an incomplete answer.
type Rows = Record<string, unknown>[];
export function serve(payload: { query: string; variables: Record<string, string | null> }, raw: string): string {
	let response: { data?: { viewer: unknown; repository: Record<string, unknown> & { issues: Rows } }; errors?: unknown; totals?: Record<string, number> };
	try { response = JSON.parse(raw); } catch { return raw; }
	if (response.errors || !response.data) return raw;
	const { data, totals = {} } = response;
	const size = Number(payload.query.match(/first:(\d+)/)![1]);
	const page = <T>(rows: T[], key: string, after?: string | null) => {
		const start = after ? Number(after) : 0;
		return {
			totalCount: totals[key] ?? rows.length,
			pageInfo: { hasNextPage: start + size < rows.length, endCursor: String(start + size) },
			nodes: rows.slice(start, start + size),
		};
	};
	const issueConnections = ["subIssues", "blockedBy", "labels", "assignees", "comments"];
	const shape = (issue: Record<string, unknown>) => ({
		...issue, ...Object.fromEntries(issueConnections.map(field => [field, page(issue[field] as unknown[], field + ":" + issue.number)])),
	});
	const operation = payload.query.match(/query\s+(\w+)/)![1];
	const after = payload.variables.after;
	const { labels, issues, ...repository } = data.repository as Record<string, unknown> & { id: unknown; labels: unknown[]; issues: Rows };
	if (operation === "TrackerSnapshot") return JSON.stringify({ data: { viewer: data.viewer, repository: {
		...repository, labels: page(labels, "labels"), issues: { ...page(issues, "issues"), nodes: page(issues, "issues").nodes.map(shape) },
	} } });
	if (operation === "TrackerLabels") return JSON.stringify({ data: { repository: { id: repository.id, labels: page(labels, "labels", after) } } });
	if (operation === "TrackerIssues") return JSON.stringify({ data: { repository: { id: repository.id,
		issues: { ...page(issues, "issues", after), nodes: page(issues, "issues", after).nodes.map(shape) } } } });
	const field = payload.query.match(/\.\.\. on Issue \{ (\w+)\(/)![1]!;
	const issue = issues.find(row => row.id === payload.variables.id)!;
	return JSON.stringify({ data: { node: { [field]: page(issue[field] as unknown[], field + ":" + issue.number, after) } } });
}
