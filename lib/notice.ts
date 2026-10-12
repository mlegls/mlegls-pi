// Command feedback that reaches the user in every host. bb runs pi in RPC mode and drops ctx.ui.notify (with setStatus,
// setWidget, setTitle and set_editor_text), so under bb a notice is a displayed custom message instead; the bb extension
// keeps those messages out of the model's context.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export const NOTICE = "notice";
export type Level = "info" | "warning" | "error";

export const insideBb = (env = process.env) => !!env.BB_THREAD_ID;

/** Tell the user something: ctx.ui.notify in a terminal, a displayed transcript message under bb. */
export function notice(pi: Pick<ExtensionAPI, "sendMessage">, ctx: Pick<ExtensionContext, "ui">, text: string, level: Level = "info"): void {
	if (!insideBb()) { ctx.ui.notify(text, level); return; }
	pi.sendMessage({ customType: NOTICE, content: level === "info" ? text : level + ": " + text, display: true, details: { level } });
}

/** The context without notices, which are for the user only. */
export function withoutNotices(messages: AgentMessage[]): AgentMessage[] | undefined {
	const kept = messages.filter((m) => !(m.role === "custom" && (m as { customType?: string }).customType === NOTICE));
	return kept.length === messages.length ? undefined : kept;
}
