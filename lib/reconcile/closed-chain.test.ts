import { expect, test } from "bun:test";
import { getTracker } from "../tracker.ts";
import { prepare, until } from "./setup-fixture";

// 2026-11-21 Concept: the maintainer closed an issue while its implement worker ran. visit() returned done before
// reaching the chain, so the worker's later `done` went unread through every restart, with nothing raised.
test("a node closed under its running chain is held for the owner, and reopening it carries the worker's report on", async () => {
	const f = await prepare();
	try {
		getTracker(f.repo).update("solo", { stage: "done" });
		f.report({ entry: "bun app.ts" });
		const ex = await until(() => f.state()?.exceptions.solo);
		expect(ex.reason).toBe("closed outside the run while its chain runs");
		expect(ex.level).toBe("owner");
		expect(f.state()!.chains.solo.phase).toBe("implement");
		getTracker(f.repo).update("solo", { stage: "ready", decompose: null });
		await until(() => f.state()?.chains.solo.phase === "drive" && f.bb.threads().some(t => t.title.includes("-drive-")));
		expect(f.state()!.exceptions.solo).toBeUndefined();
	} finally { await f.close(); }
}, 60_000);
