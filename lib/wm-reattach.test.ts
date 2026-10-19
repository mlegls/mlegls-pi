import { expect, test } from "bun:test";
import { attach, wait } from "./wm";
import type { BbThread } from "./thread/bb";

const thread = (archivedAt: number | null = null): BbThread => ({ id: "thr_1", status: "idle", archivedAt, parentThreadId: null });

test("a reattached worker follows its bb thread: live or idle stays, archived or absent exits", async () => {
	const w = attach("run", "worker", "/other/repo", "", undefined, "thr_1");
	try {
		await w.observe(new Map([["thr_1", thread()]]));
		expect((await wait([w], { timeoutMs: 5 })).size).toBe(0);
		await w.observe(new Map([["thr_1", thread(Date.now())]]));
		expect((await w.next()).kind).toBe("exited");
	} finally { w.drop(); }
	const absent = attach("run", "worker", "/other/repo", "", undefined, "thr_1");
	try { await absent.observe(new Map()); expect((await absent.next()).kind).toBe("exited"); }
	finally { absent.drop(); }
});
