// Fixture GraphQL server: first/last aliases in the single TrackerSnapshot operation.
// totals overrides declared totalCount ("issues", "labels" or "<connection>:<issue number>").
type Rows = Record<string, unknown>[];
export function serve(payload: { query: string; variables: Record<string, string | null> }, raw: string): string {
	let response: { data?: { viewer: unknown; repository: Record<string, unknown> & { issues: Rows } }; errors?: unknown; totals?: Record<string, number> };
	try { response = JSON.parse(raw); } catch { return raw; }
	if (response.errors || !response.data) return raw;
	const { data, totals = {} } = response;
	const size = Number(payload.query.match(/first:(\d+)/)![1]);
	const page = <T>(rows: T[], key: string, end: "first" | "last") => ({
		totalCount: totals[key] ?? rows.length,
		pageInfo: { hasNextPage: end === "first" && rows.length > size, hasPreviousPage: end === "last" && rows.length > size },
		nodes: end === "first" ? rows.slice(0, size) : rows.slice(-size),
	});
	const ends = (field: string, rows: Rows, key: string) => Object.fromEntries(["first", "last"].map(end => [
		field + (end === "first" ? "First" : "Last"), page(rows, key, end as "first" | "last"),
	]));
	const issueConnections = ["subIssues", "blockedBy", "labels", "assignees", "comments"];
	const shape = (issue: Record<string, unknown>) => ({
		...issue, ...Object.assign({}, ...issueConnections.map(field => ends(field, issue[field] as Rows, field + ":" + issue.number))),
	});
	const { labels, issues, ...repository } = data.repository as Record<string, unknown> & { labels: Rows; issues: Rows };
	return JSON.stringify({ data: { viewer: data.viewer, repository: {
		...repository, ...ends("labels", labels, "labels"), ...ends("issues", issues.map(shape), "issues"),
	} } });
}
