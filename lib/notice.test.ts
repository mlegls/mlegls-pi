import { afterEach, describe, expect, test } from "bun:test";
import { NOTICE, notice, withoutNotices } from "./notice.ts";

const saved = process.env.BB_THREAD_ID;
afterEach(() => { if (saved === undefined) delete process.env.BB_THREAD_ID; else process.env.BB_THREAD_ID = saved; });

function host() {
	const notified: [string, string][] = [], sent: { customType: string; content: unknown; display?: boolean }[] = [];
	return { notified, sent, pi: { sendMessage: (m: any) => { sent.push(m); } }, ctx: { ui: { notify: (t: string, l: string) => { notified.push([t, l]); } } } as any };
}

describe("notice", () => {
	test("notifies in a terminal", () => {
		delete process.env.BB_THREAD_ID;
		const h = host();
		notice(h.pi as any, h.ctx, "hi", "warning");
		expect(h.notified).toEqual([["hi", "warning"]]);
		expect(h.sent).toEqual([]);
	});

	test("under bb, shows a transcript message the model never sees", () => {
		process.env.BB_THREAD_ID = "thr_x";
		const h = host();
		notice(h.pi as any, h.ctx, "hi", "error");
		expect(h.notified).toEqual([]);
		expect(h.sent).toMatchObject([{ customType: NOTICE, content: "error: hi", display: true }]);
		const user = { role: "user", content: "q", timestamp: 0 } as any;
		expect(withoutNotices([user, { role: "custom", ...h.sent[0], timestamp: 0 } as any])).toEqual([user]);
		expect(withoutNotices([user])).toBeUndefined();
	});
});
