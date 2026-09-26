// The end of a pi session as a transcript, for previews of agents without a pane (parked,
// ended, or running headless): recent user/assistant text and one line per tool call.

import { closeSync, fstatSync, openSync, readSync } from "node:fs";

const c = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;

export function transcriptTail(file: string, lines: number, width: number): string[] {
	let text = "";
	try {
		const fd = openSync(file, "r");
		const size = fstatSync(fd).size, len = Math.min(size, 400_000);
		const buf = Buffer.alloc(len);
		readSync(fd, buf, 0, len, size - len);
		closeSync(fd);
		text = buf.toString("utf8");
	} catch { return []; }
	const out: string[] = [];
	const wrap = (s: string, prefix = "") => {
		for (const raw of s.split("\n")) {
			let l = raw;
			do { out.push(prefix + l.slice(0, Math.max(10, width - prefix.length))); l = l.slice(Math.max(10, width - prefix.length)); } while (l);
		}
	};
	for (const line of text.split("\n").slice(1)) {
		let e: any;
		try { e = JSON.parse(line); } catch { continue; }
		const m = e.message;
		if (e.type !== "message" || !m) continue;
		const parts = typeof m.content === "string" ? [{ type: "text", text: m.content }] : Array.isArray(m.content) ? m.content : [];
		if (m.role === "user") {
			const t = parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n").trim();
			if (t) { out.push(""); wrap(t, c("1;36", "› ")); }
		} else if (m.role === "assistant") {
			for (const p of parts) {
				if (p.type === "text" && p.text?.trim()) { out.push(""); wrap(p.text.trim()); }
				else if (p.type === "toolCall") {
					const a = p.arguments ?? {};
					const arg = String(a.command ?? a.path ?? a.file_path ?? JSON.stringify(a)).replace(/\s+/g, " ");
					out.push(c("90", `  ${p.name} ${arg}`.slice(0, width)));
				}
			}
		} else if (m.role === "toolResult" && m.isError) out.push(c("31", "  ✗ tool error"));
	}
	return out.slice(-lines);
}
