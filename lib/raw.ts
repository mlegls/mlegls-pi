// Exact regions inside bash tool output. Commands mark text that must reach the model
// verbatim (anchors, exact quotes) between two private OSC lines; the bash tool strips
// the marks and runs its attention filter only on the rest. Terminals ignore unknown OSC
// sequences, so the marks are invisible outside the tool as well.

export const OPEN = "\x1b]ab;raw\x07\n";
export const CLOSE = "\x1b]ab;/raw\x07\n";

/** Whether this process writes into the ab-aware bash tool, which reads the marks. */
export const inTool = () => !!process.env.AB_OUT;

/** Text between the marks, when writing into the tool; unchanged otherwise. */
export function exact(text: string): string {
	if (!inTool()) return text;
	return OPEN + text + (text.endsWith("\n") || !text ? "" : "\n") + CLOSE;
}

export interface Segment { text: string; raw: boolean }

/**
 * Split marked output into exact and filterable segments, dropping the marks. An open
 * mark without its close (cut off by truncation) stays exact to the end; a close
 * without an open is dropped. Nested marks flatten into the outer region.
 */
export function segments(text: string): Segment[] {
	const out: Segment[] = [];
	let depth = 0, current = "";
	const push = (raw: boolean) => { if (current) out.push({ text: current, raw }); current = ""; };
	for (const line of text.split(/(?<=\n)/)) {
		if (line === OPEN || line === OPEN.slice(0, -1)) { if (depth++ === 0) push(false); continue; }
		if (line === CLOSE || line === CLOSE.slice(0, -1)) { if (depth > 0 && --depth === 0) push(true); continue; }
		current += line;
	}
	push(depth > 0);
	return out;
}
