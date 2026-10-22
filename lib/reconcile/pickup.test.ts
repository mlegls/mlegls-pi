import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { Issue } from "../tracker";
import { configure, loadPickup, scan, select, stopPickup } from "./pickup";

const row = (slug: string, o: Partial<Issue> = {}): Issue => ({ slug, archived: false, ownStage: "ticket", effectiveStage: "ticket", partOf: null,
	assignee: "agent", blockedBy: [], guards: [], ready: true, eligible: true, frontier: true, deferred: false, done: false, claims: [], selectors: [], ...o });
const rows = (...r: Issue[]) => new Map(r.map(i => [i.slug, i]));

test("select takes maximal in-scope frontier roots and names why it skips the rest", () => {
	const snapshot = rows(
		row("a"),
		row("outside"),
		row("p", { ownStage: "goal", effectiveStage: "goal", ready: false, frontier: false, claims: [{ slug: "p", claimedBy: "session:shaper" }] }),
		row("c", { partOf: "p" }),
		row("e", { ownStage: "spec", effectiveStage: "spec" }),
		row("d", { partOf: "e" }),
		row("ran"),
		row("fresh"),
		row("human", { assignee: "human", eligible: false, frontier: false }),
		row("again"),
	);
	const scope = ["a", "p", "e", "ran", "fresh", "human", "again"];
	const picked = select({ scope, settle: 60_000, started: { again: { at: "t", pid: 1 } } }, snapshot, new Map([["ran", "stopped"]]),
		slugs => slugs.includes("fresh") ? 1_000_000 - 10_000 : 0, 1_000_000);
	expect(picked.start.sort()).toEqual(["a", "e"]);
	expect(picked.skipped).toEqual({
		c: "ancestor p claimed: session:shaper",
		d: "inside frontier root e",
		ran: "has reconciler state (stopped); restart it by hand",
		fresh: "settling: changed 10s ago",
		again: "already started by pickup at t",
	});
	expect(picked.retryIn).toBe(50_000);
	expect(select({ scope: "project", settle: 0, started: {} }, snapshot, new Map(), () => 0, 0).start).toContain("outside");
});

const root = mkdtempSync(join(tmpdir(), "pickup-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
const issue = (slug: string, fields: string, body = "Contract.") => writeFileSync(join(root, "docs/issues", slug + ".md"), "---\n" + fields + "\n---\n" + body + "\n");

test("scan starts each eligible root once, across rescans, and not while paused", async () => {
	git("init", "-q", "-b", "main");
	mkdirSync(join(root, "docs/issues"), { recursive: true });
	issue("ready-one", "stage: ticket\nassignee: agent\nauthor: session:test");
	issue("later", "stage: goal\nassignee: agent\nauthor: session:test");
	issue("for-human", "stage: ticket\nassignee: human\nauthor: session:test");
	issue("blocked", "stage: ticket\nassignee: agent\nauthor: session:test\nblocked-by: [\"[[projects/x/issues/later]]\"]");
	issue("held", "stage: ticket\nassignee: agent\nauthor: session:test\nclaimed-by: session:other");
	issue("unscoped", "stage: ticket\nassignee: agent\nauthor: session:test");
	git("add", "-A"); git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "issues");
	const old = new Date(Date.now() - 3_600_000);
	for (const s of ["ready-one", "later", "for-human", "blocked", "held", "unscoped"]) utimesSync(join(root, "docs/issues", s + ".md"), old, old);
	await configure({ cwd: root, owner: "thr_owner", scope: ["ready-one", "later", "for-human", "blocked", "held"], watch: false });
	const starts: string[] = [];
	const startRun = (r: string) => { starts.push(r); return { pid: 4242 }; };
	expect(scan(root, { startRun }).started).toEqual(["ready-one"]);
	expect(scan(root, { startRun }).started).toEqual([]);
	expect(starts).toEqual(["ready-one"]);
	// A tracker write makes the goal ready: taken after it settles, once.
	issue("later", "stage: ticket\nassignee: agent\nauthor: session:test");
	const settling = scan(root, { startRun });
	expect(settling.started).toEqual([]);
	expect(settling.skipped.later).toMatch(/^settling/);
	await configure({ cwd: root, owner: "thr_owner", paused: true, watch: false });
	expect(scan(root, { startRun, now: () => Date.now() + 120_000 }).started).toEqual([]);
	await configure({ cwd: root, owner: "thr_owner", paused: false, watch: false });
	expect(scan(root, { startRun, now: () => Date.now() + 120_000 }).started).toEqual(["later"]);
	expect(scan(root, { startRun, now: () => Date.now() + 120_000 }).started).toEqual([]);
	// "blocked" waited on "later", which is not done; human and claimed trees were never eligible; unscoped is outside.
	expect(starts).toEqual(["ready-one", "later"]);
	expect(Object.keys(loadPickup(root)!.started).sort()).toEqual(["later", "ready-one"]);
	stopPickup(root);
	expect(scan(root, { startRun }).started).toEqual([]);
}, 30_000);

test("enabling takes an explicit scope", async () => {
	const other = mkdtempSync(join(tmpdir(), "pickup-scope-"));
	try {
		execFileSync("git", ["-C", other, "init", "-q"]);
		mkdirSync(join(other, "docs/issues"), { recursive: true });
		await expect(configure({ cwd: other, owner: "thr_owner", watch: false })).rejects.toThrow(/explicit scope/);
		await expect(configure({ cwd: other, owner: "thr_owner", scope: ["nope"], watch: false })).rejects.toThrow(/not in the tracker: nope/);
	} finally { rmSync(other, { recursive: true, force: true }); }
});
