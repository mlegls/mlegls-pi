// A renderer is a query over the records store and a cut of what it found under a budget,
// producing a section of context. Where the section goes (injected live, a compaction summary,
// a tool result) is up to whoever runs it; a consumer that resumes keeps a cursor
// (lib/records/cursor). The view is what the query is parameterized by: for a session, its
// branch (lib/records/branch: visibility is `at ∈ ancestors(tip)`).

export interface Section {
	text: string;
	/** Structured form of the section, stored by the consumer (e.g. compaction details). */
	details?: unknown;
}

export interface Renderer<View, Found = unknown> {
	name: string;
	/**
	 * What its section is for, e.g. `memory` (the session's account of its own past). Two active
	 * renderers with the same role are two systems doing one job, and are reported as a conflict;
	 * different roles compose.
	 */
	role: string;
	query(view: View): Found;
	/** budget: the renderer's own unit and meaning (see its schema's settings); Infinity = no cut. */
	cut(found: Found, budget: number, view: View): Section | undefined;
}

export function render<View, Found>(r: Renderer<View, Found>, view: View, budget: number): Section | undefined {
	return r.cut(r.query(view), budget, view);
}
