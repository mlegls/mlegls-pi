import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { hookFailure } from "./reconcile";

function fixture(mode: string) {
	const output = execFileSync("bun", ["docs/attachments/probe-conflicts-and-prepare-deps-around-integrate/fixture.ts", mode],
		{ encoding: "utf8", stdio: "pipe", timeout: 30_000 });
	return JSON.parse(output.split("\n").find(line => line.startsWith("RESULT "))!.slice(7));
}

// Approved local Git fixture: exercise the actual reconciler's child-mail and integrate paths.
test("landing sends conflicted files and target commit subjects to the child without integrating", () => {
	const result = fixture("conflict");
	expect(result.message).toContain("conflict.txt");
	expect(result.message).toContain("Target conflict subject");
	expect(result.targetAfter).toBe(result.targetBefore);
	expect(result.childAfter).toBe(result.childBefore);
	expect(result.order).toEqual([]);
	expect(result.done).toBe(false);
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
