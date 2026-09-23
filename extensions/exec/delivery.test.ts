import { expect, test } from "bun:test";
import { deliver } from "./delivery";
import type { KernelLate } from "./kernel";

const late = (handle: string, text: string, extra: Partial<KernelLate> = {}): KernelLate => ({ handle, content: [{ type: "text", text }], passive: false, ...extra });
const text = (content: any[]) => content.map(block => block.text ?? "").join("");

// Want: output the conversation already accounted for collapses to a recoverable line and does not wake the agent.
test("late output judged already accounted for is quiet; new output and errors wake", async () => {
	const seen: any[] = [];
	const judge = async (arrivals: any[]) => { seen.push(...arrivals); return arrivals.map(a => a.handle === "c3.1" ? 0.9 : 0.1); };
	const quiet = await deliver([late("c3.1", "\nmerged unit-a into main\nmore detail\n"), late("c3", "done\n", { passive: true })], "assistant: merged unit-a", () => "children.turnEnd()", judge);
	expect(text(quiet.content)).toBe('[c3.1] quiet: likely already accounted for; show.pull("c3.1") for the full output\nmerged unit-a into main\n[c3]\ndone\n');
	expect(quiet.wake).toBe(false);
	expect(seen).toEqual([{ handle: "c3.1", code: "children.turnEnd()", text: "\nmerged unit-a into main\nmore detail\n" }]);

	const loud = await deliver([late("c3.1", "x\n"), late("c4.1", "build ok\n"), late("c5", "", { error: "Error: boom" })], "assistant: merged", () => undefined, judge);
	expect(loud.wake).toBe(true);
	expect(text(loud.content)).toContain("[c4.1]\nbuild ok\n");
	expect(text(loud.content)).toContain("[c5] failed\nError: boom\n");
});

// Want: without a conversation or a working judge, late output is delivered in full.
test("unavailable novelty judgment delivers in full", async () => {
	const failing = async () => { throw new Error("no key"); };
	const result = await deliver([late("c1.1", "hi\n")], "user: hi", () => undefined, failing);
	expect(result.wake).toBe(true);
	expect(text(result.content)).toBe("[c1.1]\nhi\n");
	let called = false;
	await deliver([late("c1.1", "hi\n")], "", () => undefined, async () => { called = true; return [1]; });
	expect(called).toBe(false);
});
