import { novelty, type Arrival } from "../../lib/ingress";
import type { ContentBlock } from "./image";
import type { KernelLate } from "./kernel";

/** Below this probability of "already accounted for", late output is delivered in full and wakes the agent. */
export const QUIET_AT = 0.8;

export interface Delivery { content: ContentBlock[]; handles: string[]; wake: boolean }

const textOf = (event: KernelLate) => event.content.map(block => block.type === "text" ? block.text : "").join("");

/**
 * Render late output by handle. Output judged already accounted for by the conversation
 * collapses to its handle and first line and does not wake the agent; errors never do.
 */
export async function deliver(events: KernelLate[], conversation: string, origin: (handle: string) => string | undefined, judge: (arrivals: Arrival[], conversation: string) => Promise<number[]> = novelty): Promise<Delivery> {
	const candidates = events.filter(event => !event.passive && !event.error && textOf(event).trim());
	const quiet = new Set<KernelLate>();
	if (candidates.length && conversation) {
		try {
			const handled = await judge(candidates.map(event => ({ handle: event.handle, code: origin(event.handle), text: textOf(event) })), conversation);
			candidates.forEach((event, i) => { if (handled[i] >= QUIET_AT) quiet.add(event); });
		} catch { /* judgment unavailable: deliver in full */ }
	}
	const content = events.flatMap((event): ContentBlock[] => {
		if (quiet.has(event)) {
			const gist = textOf(event).split("\n").find(line => line.trim())!.slice(0, 160);
			return [{ type: "text", text: `[${event.handle}] quiet: likely already accounted for; show.pull("${event.handle}") for the full output\n${gist}\n` }];
		}
		return [
			{ type: "text", text: `[${event.handle}]${event.error ? " failed" : ""}\n` },
			...event.content,
			...(event.error ? [{ type: "text" as const, text: event.error + "\n" }] : []),
		];
	});
	return { content, handles: events.map(event => event.handle), wake: events.some(event => !event.passive && !quiet.has(event)) };
}
