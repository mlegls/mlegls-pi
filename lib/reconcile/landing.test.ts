import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { hookFailure } from "./reconcile";

function fixture(mode: string) {
	const output = execFileSync("bun", ["docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts", mode],
		{ encoding: "utf8", stdio: "pipe", timeout: 30_000, env: { ...process.env, PI_RECONCILE_TICK_MS: "100" } });
	return JSON.parse(output.split("\n").find(line => line.startsWith("RESULT "))!.slice(7));
}

// Real Git and reconciler, with BB turns supplied by the local fixture.
test("a conflict goes to the handler with both heads intact and lands without another review", () => {
	const result = fixture("conflict");
	expect(result.message).toContain("conflict.txt");
	expect(result.message).toContain("Target conflict subject");
	expect(result.message).toContain(result.childBefore);
	expect(result.started.target).toBe(result.targetBefore);
	expect(result.started.child).toBe(result.childBefore);
	expect(result.started.handler).toBe(result.childBefore);
	expect(result.handlers).toBe(1);
	expect(result.reviews).toBe(0);
	expect(result.toldReviewer).toBe(false);
	expect(result.settledOnTarget).toBe(true);
	expect(result.landed).toBe(true);
}, 30_000);

test("inherited format failure goes to a target-tip handler and lands once without another review", () => {
	const result = fixture("format");
	expect(result.message).toContain("Format issues found");
	expect(result.message).toContain(result.childBefore);
	expect(result.started.handler).toBe(result.targetBefore);
	expect(result.targetRepairDiff).toBe("inherited.js");
	expect(result.settledOnTarget).toBe(true);
	expect(result.handlers).toBe(1);
	expect(result.reviews).toBe(0);
	expect(result.toldReviewer).toBe(false);
	expect(result.order).toEqual(["gate", "setup", "gate"]);
	expect(result.landed).toBe(true);
}, 30_000);

test("a landing handler that edits reviewed code sends its head to review before landing", () => {
	const result = fixture("code-repair");
	expect(result.handlers).toBe(1);
	expect(result.reviews).toBe(1);
	expect(result.reviewHead).toBe(result.settled);
	expect(result.targetAfter).toBe(result.targetBefore);
	expect(result.landed).toBe(false);
}, 30_000);

test("a failing post-merge hook is found in what the landing merge printed; an ordinary fast-forward is not one", () => {
	const ok = "Updating 1111111..2222222\nFast-forward\n hooks/failed-before.ts | 2 +-\n 1 file changed";
	expect(hookFailure(ok)).toBeUndefined();
	const failed = ok + "\nError: Final-tree regeneration requires an index matching HEAD; preserve staged changes and retry\nFinal-tree artifact regeneration failed; not publishing or verifying.\nhusky - post-merge script failed (code 1)";
	expect(hookFailure(failed)).toContain("requires an index matching HEAD");
	expect(hookFailure(failed)).toContain("husky - post-merge script failed");
});

test("a rebased lockfile prepares declared deps before pre-integrate", () => {
	const result = fixture("deps");
	expect(result.done).toBe(true);
	expect(result.order).toEqual(["deps", "gate"]);
}, 30_000);
