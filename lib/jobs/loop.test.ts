import { test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HARNESS, candidates, holdOnIssue, isNode } from "./loop.ts";

test("a hold files its question on the issue, hands it to the human, and commits only that file", () => {
	const dir = mkdtempSync(join(tmpdir(), "loop-hold-")), git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
	git("init", "-q"); mkdirSync(join(dir, "docs/issues"), { recursive: true });
	const a = join(dir, "docs/issues/a.md"), b = join(dir, "docs/issues/b.md");
	writeFileSync(a, "---\nstage: ticket\nassignee: agent\n---\nDo the thing.\n"); writeFileSync(b, "---\nstage: ticket\n---\nOther.\n");
	git("add", "."); git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
	writeFileSync(join(dir, "dirty"), "x"); git("add", "dirty");
	holdOnIssue(dir, a, "Which unit?", 3); holdOnIssue(dir, b, "Why?", 3);
	expect(readFileSync(a, "utf8")).toMatch(/^---\nstage: ticket\nassignee: human\n---\nDo the thing\.\n\nQuestion from `ab supervise loop` \(iteration 3, .*\): Which unit\? Answer here/);
	expect(readFileSync(b, "utf8")).toContain("stage: ticket\nassignee: human\n---");
	expect(git("status", "--porcelain").trim()).toBe("A  dirty");
	expect(git("log", "--format=%s", "-2").trim().split("\n")).toEqual(["hold b: question for the author", "hold a: question for the author"]);
});

test("harness deferrals are told apart from ticket ones", () => {
	for (const r of ["launch failed", "worker did not start within 30s (no pi session found)", "unreachable", "resume failed", "loop error: x"]) expect(HARNESS.test(r)).toBe(true);
	for (const r of ["timeboxed", "integration failed", "needs-input", "review did not end with every story held"]) expect(HARNESS.test(r)).toBe(false);
});

test("candidates are one level of the tree: ready leaves and nodes with ready work below, or a finished node's final join", () => {
	const i = (slug: string, partOf: string | null, frontier = true, done = false) => ({ slug, file: "", partOf, frontier, done, effectiveStage: "ticket" });
	const issues = [i("a", null), i("n", null, false), i("n1", "n"), i("n2", "n", false), i("m", null, false), i("m1", "m", false), i("d", null, true, true), i("fin", null), i("fin1", "fin", true, true)];
	const at = (target: string, nested = false) => candidates({ target, nested } as any, issues).map(x => x.slug);
	expect(at("")).toEqual(["a", "n", "fin"]);
	expect(at("n", true)).toEqual(["n1"]);
	expect(at("fin", true)).toEqual([]);
	expect(at("a")).toEqual(["a"]);
	expect(isNode(issues, "fin")).toBe(true);
	expect(isNode(issues, "a")).toBe(false);
});
