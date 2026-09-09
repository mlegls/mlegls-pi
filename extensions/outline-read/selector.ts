/**
 * Line selectors appended to a path: `:50`, `:50-`, `:50-200`, `:50+150`,
 * `:5-16,40-80`, `:all`. Ranges are 1-indexed inclusive.
 */
export interface LineRange {
	start: number;
	/** Inclusive; undefined means to end of file. */
	end?: number;
}

export type Selector = { kind: "all" } | { kind: "ranges"; ranges: LineRange[] };

const RANGE = /^(\d+)(?:(-)(\d*)|\+(\d+))?$/;
const SELECTOR = /^(.+?):((?:\d+(?:-\d*|\+\d+)?)(?:,\d+(?:-\d*|\+\d+)?)*|all)$/;

export function parseRange(text: string): LineRange | undefined {
	const m = RANGE.exec(text);
	if (!m) return undefined;
	const start = Number(m[1]);
	if (start < 1) return undefined;
	if (m[2] === "-") return m[3] ? { start, end: Number(m[3]) } : { start };
	if (m[4] !== undefined) return { start, end: start + Number(m[4]) - 1 };
	return { start, end: start };
}

/** Split `path:selector`; returns the path unchanged when there is no selector. */
export function splitSelector(input: string): { path: string; selector?: Selector } {
	const m = SELECTOR.exec(input);
	if (!m) return { path: input };
	if (m[2] === "all") return { path: m[1], selector: { kind: "all" } };
	const ranges: LineRange[] = [];
	for (const part of m[2].split(",")) {
		const range = parseRange(part);
		if (!range) return { path: input };
		ranges.push(range);
	}
	return { path: m[1], selector: { kind: "ranges", ranges } };
}

/** Sort, clamp to the file, and merge overlapping or adjacent ranges. */
export function normalizeRanges(ranges: LineRange[], totalLines: number): Array<{ start: number; end: number }> {
	const clamped = ranges
		.map((r) => ({ start: Math.max(1, r.start), end: Math.min(totalLines, r.end ?? totalLines) }))
		.filter((r) => r.start <= r.end)
		.sort((a, b) => a.start - b.start);
	const merged: Array<{ start: number; end: number }> = [];
	for (const range of clamped) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
		else merged.push({ ...range });
	}
	return merged;
}

export function formatRanges(ranges: Array<{ start: number; end: number }>): string {
	return ranges.map((r) => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)).join(",");
}
