// optmem's log: the session's own transcript read as UniiChat messages (gist §1). pi's session file
// is already append-only and single-writer, so nothing is copied: message i is the i-th message
// on the branch path, and on a tree path an entry's ancestors never change, so i is permanent
// there and forks share the prefix. Each message has a kind:
//
//   user   the user's words           agent  the agent's replies (thinking is never logged)
//   tool   one tool call (name, JSON)  echo   one tool result, clipped to its head and tail
//   work   a message from outside the conversation (board mail, extension reports)
//
// A tool result is clipped to ECHO_CHARS in all; any other long text is split over several
// messages in a row, never cut.
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export type Kind = "user" | "agent" | "tool" | "echo" | "work";

export interface Msg {
	kind: Kind;
	text: string;
	/** Session entry id it came from, and its position among that entry's messages. */
	entry: string;
	k: number;
	date: string;
}

export const ECHO_CHARS = 30_000;
export const PAGE_CHARS = 30_000;

export function clip(text: string, max = ECHO_CHARS): string {
	if (text.length <= max) return text;
	const half = Math.floor(max / 2);
	return text.slice(0, half) + "\n…[" + (text.length - 2 * half) + " characters clipped]…\n" + text.slice(-half);
}

export function pages(text: string, max = PAGE_CHARS): string[] {
	if (text.length <= max) return [text];
	const out: string[] = [];
	for (let at = 0; at < text.length; at += max) out.push(text.slice(at, at + max));
	return out;
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((c: any) => c?.type === "text" ? c.text : c?.type === "image" ? "[image]" : "").filter(Boolean).join("\n");
}

/** A message's key: its entry and position there. Stable on any branch through that entry. */
export const msgKey = (m: Msg) => m.entry + "." + m.k;

/** The branch's messages, oldest first, each with the index of the branch entry it came from. */
export function messagesOf(branch: readonly SessionEntry[]): (Msg & { at: number })[] {
	const out: (Msg & { at: number })[] = [];
	branch.forEach((e, at) => {
		const date = e.timestamp;
		let k = 0;
		const push = (kind: Kind, text: string) => { if (text.trim()) out.push({ kind, text, entry: e.id, k: k++, date, at }); };
		const many = (kind: Kind, text: string) => { for (const p of pages(text)) push(kind, p); };
		if (e.type === "custom_message") many("work", textOf(e.content));
		if (e.type !== "message") return;
		const m: any = e.message;
		switch (m.role) {
			case "user": many("user", textOf(m.content)); break;
			case "assistant":
				for (const c of m.content ?? []) {
					if (c.type === "text") many("agent", c.text);
					else if (c.type === "toolCall") many("tool", c.name + " " + JSON.stringify(c.arguments ?? {}));
				}
				break;
			case "toolResult": push("echo", clip((m.isError ? "[error] " : "") + textOf(m.content))); break;
			case "bashExecution": push("echo", clip("!" + m.command + "\n" + (m.output ?? ""))); break;
			case "custom": many("work", textOf(m.content)); break;
		}
	});
	return out;
}

/** The text a leaf compresses: "kind: text". */
export const source = (m: Msg) => m.kind + ": " + m.text;
