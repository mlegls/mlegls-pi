// The view as cacheable content (gist §3.3). It goes in blocks of 4 lines, one text part each, so
// an Anthropic cache mark can sit on its last whole block: entries are stored only at marks and
// looked up to 20 blocks back, so the next call (whose view only grew at its end) finds this mark
// and pays only for the lines after it. Other providers cache any repeated prefix by themselves.

export const BLOCK_LINES = 4;
export const OPEN = "<chat>\n", CLOSE = "</chat>";

/** The view's lines as text parts: whole blocks first, then the partial one with the closing tag. */
export function chatParts(lines: string[]): { type: "text"; text: string }[] {
	const parts: { type: "text"; text: string }[] = [];
	const whole = Math.floor(lines.length / BLOCK_LINES) * BLOCK_LINES;
	for (let k = 0; k < whole; k += BLOCK_LINES) parts.push({ type: "text", text: (k ? "" : OPEN) + lines.slice(k, k + BLOCK_LINES).join("\n") + "\n" });
	parts.push({ type: "text", text: (whole ? "" : OPEN) + lines.slice(whole).map((l) => l + "\n").join("") + CLOSE });
	return parts;
}

const MAX_MARKS = 4;

/**
 * An Anthropic Messages payload with a cache mark on the view's last whole block. pi marks the
 * system prompt, the last tool and the last message (and with OAuth, its identity block); to stay
 * within 4 marks the tool mark goes first (the system mark caches the tools before it), then
 * earlier system marks. Any other payload is returned as is.
 */
export function markView(payload: any): any {
	const msgs = payload?.messages;
	if (!Array.isArray(msgs) || !("system" in payload)) return payload; // Anthropic Messages puts the system prompt beside messages
	const view = msgs.find((m: any) => Array.isArray(m?.content) && typeof m.content[0]?.text === "string" && m.content[0].text.startsWith(OPEN));
	if (!view || view.content.length < 2) return payload;
	const target = view.content[view.content.length - 2];
	if (target.cache_control) return payload;
	const marked: any[] = [];
	const visit = (o: any) => { if (o && typeof o === "object") { if (o.cache_control) marked.push(o); for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === "object") visit(v); } };
	visit(payload.tools); visit(payload.system); visit(msgs);
	const drop: any[] = [];
	for (const t of payload.tools ?? []) if (t?.cache_control) drop.push(t);
	if (Array.isArray(payload.system)) drop.push(...payload.system.filter((b: any) => b?.cache_control).slice(0, -1));
	let count = marked.length;
	for (const o of drop) { if (count + 1 <= MAX_MARKS) break; delete o.cache_control; count--; }
	if (count + 1 > MAX_MARKS) return payload;
	const like = marked.find((o) => o.cache_control && (payload.system ?? []).includes(o)) ?? marked.find((o) => o.cache_control);
	target.cache_control = { ...(like?.cache_control ?? { type: "ephemeral" }) }; // same lifetime as pi's own marks
	return payload;
}
