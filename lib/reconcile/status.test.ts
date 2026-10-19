import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderStatus } from "./status";
import { saveState, type State } from "./reconcile";

const state = (root: string, cwd: string, extra: Partial<State> = {}): State => ({ backend: "threads", root, cwd, owner: "mail/fixture", budget: 1,
	landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [], ...extra });

test("renders in-flight nodes newest first with their bb thread, what last happened, and pending exceptions", () => {
	const s = state("tree", "/repo", {
		landed: { leaf: { into: "tree", head: "abc", at: "2026-10-19T08:00:00.000Z" } },
		chains: {
			a: { into: "tree", self: false, phase: "review", retries: {}, workers: [], handle: { run: "tree", handle: "a-review-3", path: "/w", bb: "thr_one" } },
			b: { into: "tree", self: false, phase: "implement", retries: {}, workers: [], held: true, handle: { run: "tree", handle: "b-implement-4", path: "/w2", bb: "thr_two" } },
		},
		exceptions: { b: { id: "1", node: "b", reason: "blocked", text: "", at: "2026-10-19T10:00:00.000Z", level: "owner" } },
		log: ["2026-10-19T08:00:00 landed leaf in tree", "2026-10-19T09:00:00 integration of a failed (1), sent back: conflict in x.ts", "2026-10-19T09:30:00 launched a-review-3 (review, tidy)"],
	});
	const done = state("old", "/repo", { finished: "done", landed: { old: { into: "/repo", head: "def", at: "2026-10-18T12:00:00.000Z" } } });
	const stale = state("older", "/repo", { finished: "stopped", log: ["2026-10-18T09:00:00 stopped; retired workers and handlers, kept collectors"] });
	const md = renderStatus([s, done, stale], { now: Date.parse("2026-10-19T11:00:00Z") });
	const lines = md.split("\n");
	const at = (needle: string) => lines.findIndex(l => l.includes(needle));
	expect(lines[at("**b**")]).toContain("waiting on the supervisor: blocked");
	expect(lines[at("**a**")]).toContain("review · @thread:thr_one · 10-19 09:30 launched a-review-3");
	expect(lines[at("**leaf**")]).toContain("landed 10-19 08:00");
	expect(at("**b**")).toBeLessThan(at("**a**"));
	expect(at("**a**")).toBeLessThan(at("**leaf**"));
	expect(at("## Done")).toBeGreaterThan(at("**leaf**"));
	expect(md).toContain("- old · landed 10-18 12:00");
	expect(md).not.toContain("older");
});

test("each state write regenerates one desk/STATUS.md from every run in the repository, excluded from git", () => {
	const repo = realpathSync(mkdtempSync("/tmp/rc-status-"));
	try {
		execFileSync("git", ["-C", repo, "init", "-qb", "main"]);
		const state0 = process.env.XDG_STATE_HOME;
		process.env.XDG_STATE_HOME = join(repo, ".git/state");
		try {
			saveState(state("first", repo, { chains: { x: { into: repo, self: false, phase: "implement", retries: {}, workers: [], handle: { run: "first", handle: "x-implement-1", path: repo, bb: "thr_x" } } } }));
			saveState(state("second", repo, { chains: { y: { into: repo, self: false, phase: "drive", retries: {}, workers: [] } } }));
		} finally { if (state0 === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = state0; }
		const md = readFileSync(join(repo, "desk/STATUS.md"), "utf8");
		expect(md).toContain("## first");
		expect(md).toContain("**x** · implement · @thread:thr_x");
		expect(md).toContain("## second");
		expect(readFileSync(join(repo, ".git/info/exclude"), "utf8")).toMatch(/^desk\/$/m);
		expect(execFileSync("git", ["-C", repo, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
	} finally { rmSync(repo, { recursive: true, force: true }); }
});
