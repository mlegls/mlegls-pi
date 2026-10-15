import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGithubTracker } from "./tracker-github.ts";
import { decodeGithubBody, encodeGithubBody } from "./tracker-github-state.ts";
import { GithubRateLimited, githubProject } from "./tracker-github-snapshot.ts";
import { githubRest } from "./tracker-github-write.ts";
import { untilReset } from "./reconcile/rate-limit.ts";
import { ROLES, installFakeGh, issue, label, newState, type FakeState } from "./fixtures/fake-github.ts";

// The adapter against a stateful fake of GitHub (lib/fixtures/fake-github.ts, serving reads through the committed
// docs/attachments/read-github-tracker-snapshots/fake-gh.ts): no network, no live repository.
let dir: string, cwd: string, fake: ReturnType<typeof installFakeGh>;
let savedRun: string | undefined;

function setup(issues: Record<string, any>[]) {
	cwd = join(dir, "checkout");
	mkdirSync(join(cwd, "docs/agents"), { recursive: true });
	execFileSync("git", ["init", "-q", cwd]);
	execFileSync("git", ["-C", cwd, "remote", "add", "origin", "https://github.com/fixture/tracker.git"]);
	writeFileSync(join(cwd, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: fixture/tracker\n");
	writeFileSync(join(cwd, "docs/agents/triage-labels.md"), ["| Role | Label |", "| --- | --- |", ...ROLES.map(role => "| " + role + " | " + role + " |")].join("\n"));
	fake = installFakeGh(join(dir, "bin"), newState(issues));
}
/** The saved run a reconciler leaves under <git-common-dir>/reconcile, with one writable refinement attempt. */
function saveRun(root: string) {
	const common = execFileSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
	mkdirSync(join(common, "reconcile"), { recursive: true });
	writeFileSync(join(common, "reconcile", root + ".json"), JSON.stringify({
		backend: "threads", root, cwd, landed: {}, results: {}, landingOps: {},
		refinements: { h1: { node: "gh-1", handle: "h1", claim: "reconcile:" + root + "/h1", baseline: ["gh-1", "gh-2"], parentFields: {}, owned: [], phase: "writing" } },
	}));
}
const tracker = (run?: string) => getGithubTracker(cwd, { run })!;
const edit = (change: (state: FakeState) => void) => {
	const state = fake.read(); change(state); fake.write(state);
	// The adapter's own cache would otherwise hide an out-of-band change for a minute.
	rmSync(join(execFileSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim(), "reconcile", "github-tracker"), { recursive: true, force: true });
};

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "tracker-github-test-"));
	savedRun = process.env.PI_WM_RUN; delete process.env.PI_WM_RUN;
});
afterEach(() => {
	fake?.restore();
	if (savedRun === undefined) delete process.env.PI_WM_RUN; else process.env.PI_WM_RUN = savedRun;
	rmSync(dir, { recursive: true, force: true });
});

describe("snapshot paging", () => {
	test("reads every issue and connection node past GitHub's 100-node pages", () => {
		const comments = Array.from({ length: 110 }, (_, n) => ({
			id: "C-" + n, body: "comment " + n, createdAt: new Date(1_700_000_000_000 + n * 1000).toISOString(), author: { login: "c" }, url: "https://github.com/fixture/tracker/issues/2#c" + n,
		}));
		setup(Array.from({ length: 256 }, (_, n) => issue(n + 1, n === 1 ? { comments } : {})));
		const rows = tracker().snapshot();
		expect(rows.size).toBe(256);
		expect(fake.calls("TrackerSnapshot")).toHaveLength(1);
		expect(fake.calls("TrackerIssues")).toHaveLength(2);
		expect(fake.calls("TrackerConnection").length).toBeGreaterThanOrEqual(1);
		expect((tracker().fields("gh-2")["github-comments"] as { body: string }[]).map(c => c.body)).toEqual(comments.map(c => c.body));
	}, 60_000);

});

describe("metadata envelope", () => {
	test("round-trips values containing --> and comment openers without ending the HTML comment", () => {
		const hostile = "a --> b <!-- mlegls-pi:tracker\n--> \\u003e </script> \u2028 <end>";
		const encoded = encodeGithubBody("Markdown with --> inside\n", { note: hostile, nested: { list: ["-->", "<"] } });
		expect(encoded.slice("Markdown with --> inside\n".length).match(/-->/g)).toHaveLength(1);
		const decoded = decodeGithubBody(encoded);
		expect(decoded.body).toBe("Markdown with --> inside\n");
		expect(decoded.fields).toEqual({ note: hostile, nested: { list: ["-->", "<"] } });
	});

	test("survives create, body-only update and field-only update through the adapter", () => {
		setup([issue(1)]);
		const hostile = "end --> here <!-- x -->";
		const slug = tracker().create({ slug: "hostile", fields: { title: "Hostile", assignee: "agent", author: "session:test", note: hostile }, body: "Body with --> kept\n" });
		expect(slug).toBe("gh-2");
		const stored = () => fake.read().issues.find(i => i.number === 2)!.body as string;
		expect(stored().slice("Body with --> kept\n".length).match(/-->/g)).toHaveLength(1);
		expect(tracker().fields(slug).note).toBe(hostile);
		tracker().update(slug, {}, "Replaced --> body\n");
		expect(tracker().fields(slug).note).toBe(hostile);
		expect(tracker().text(slug).endsWith("---\nReplaced --> body\n")).toBe(true);
		tracker().update(slug, { note: "x --> y" });
		expect(tracker().fields(slug).note).toBe("x --> y");
		expect(tracker().text(slug).endsWith("---\nReplaced --> body\n")).toBe(true);
	}, 60_000);
});

describe("ownership and provisional cleanup", () => {
	const token = "reconcile:r1/h1";
	beforeEach(() => {
		setup([
			issue(1), issue(2, { parentId: "I-1" }),
			issue(3, { assignees: [{ id: "U-viewer", login: "reader" }] }),
			issue(4, { assignees: [{ id: "U-other", login: "someone" }] }),
		]);
		saveRun("r1"); saveRun("r2");
	});

	test("a stable reservation is an exact receipt that survives a restart, and never steals another's assignment", () => {
		tracker("r1").update("gh-1", { "claimed-by": "reconcile:r1" });
		expect(fake.read().issues[0]!.assignees.map((u: { id: string }) => u.id)).toEqual(["U-viewer"]);
		for (const restarted of [tracker("r1"), tracker()]) {
			expect(restarted.fields("gh-1")["claimed-by"]).toBe("reconcile:r1");
			const row = restarted.snapshot().get("gh-1")!;
			expect(row.claims).toEqual([{ slug: "gh-1", claimedBy: "reconcile:r1" }]);
			expect(row.frontier).toBe(false);
		}
		tracker("r1").update("gh-1", { "claimed-by": "reconcile:r1" });
		// The same login without a receipt, another person's assignment, and another run's receipt are all foreign.
		const rows = tracker("r1").snapshot();
		expect(rows.get("gh-3")!.claims).toEqual([{ slug: "gh-3", claimedBy: "github:reader" }]);
		expect(rows.get("gh-4")!.claims).toEqual([{ slug: "gh-4", claimedBy: "github:someone" }]);
		expect(() => tracker("r1").update("gh-3", { "claimed-by": "reconcile:r1" })).toThrow(/same-login assignment is foreign/);
		expect(() => tracker("r1").update("gh-4", { "claimed-by": "reconcile:r1" })).toThrow(/foreign-assigned/);
		expect(() => tracker("r2").update("gh-1", { "claimed-by": null })).toThrow(/no exact owned native assignment/);
		expect(tracker("r1").fields("gh-1")["claimed-by"]).toBe("reconcile:r1");
	}, 60_000);

	test("a provisional child whose create or cleanup response is lost is replayed exactly once", () => {
		const create = () => tracker("r1").create({ slug: "prov", fields: { title: "Prov", assignee: "agent", "part-of": "gh-1", "claimed-by": token, author: "session:test" }, body: "Provisional.\n" });
		expect(() => tracker("r1").create({ slug: "x", fields: { title: "x", assignee: "agent", "part-of": "gh-1", "claimed-by": "reconcile:r1/nobody", author: "session:test" }, body: "x\n" }))
			.toThrow(/exact attempt authority/);
		edit(state => { state.faults.lose = ["createIssue"]; });
		expect(create).toThrow();
		expect(fake.read().issues).toHaveLength(5);
		expect(create()).toBe("gh-5");
		expect(create()).toBe("gh-5");
		expect(fake.read().issues).toHaveLength(5);
		expect(fake.calls("createIssue")).toHaveLength(1);
		let row = tracker("r1").snapshot().get("gh-5")!;
		expect(row).toMatchObject({ partOf: "gh-1", claims: [{ slug: "gh-5", claimedBy: token }] });

		// A baseline node is not a provisional child.
		expect(() => tracker("r1").remove("gh-2")).toThrow(/no exact owned native assignment|provisional/);

		edit(state => { state.faults.lose = ["removeAssigneesFromAssignable"]; });
		expect(() => tracker("r1").remove("gh-5")).toThrow(/replay the same operation/);
		const half = fake.read().issues.find(i => i.number === 5)!;
		expect(half).toMatchObject({ state: "CLOSED", stateReason: "NOT_PLANNED", assignees: [], parentId: null });
		tracker("r1").remove("gh-5");
		tracker("r1").remove("gh-5");
		expect(tracker("r1").snapshot().has("gh-5")).toBe(false);
		expect(tracker().snapshot().has("gh-5")).toBe(false);
		expect(fake.calls("closeIssue")).toHaveLength(1);
		expect(fake.read().issues).toHaveLength(5);
		expect(tracker("r1").snapshot().get("gh-1")!.claims).toEqual([]);
	}, 60_000);
});

describe("public CLI", () => {
	const cli = join(import.meta.dir, "../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
	const run = (args: string[], input?: string) => Bun.spawnSync(["bun", cli, ...args], { cwd, stdin: input === undefined ? undefined : new TextEncoder().encode(input), env: process.env });

	test("routes the vault verbs to native issues and refuses ancillary ones explicitly", () => {
		setup([issue(1, { body: "Old.\n" })]);
		const snapshot = JSON.parse(run(["snapshot", "--json"]).stdout.toString());
		expect(snapshot).toMatchObject({ schemaVersion: 1, legacy: [] });
		expect(snapshot.issues.map((row: { slug: string }) => row.slug)).toEqual(["gh-1"]);
		const update = run(["update", "gh-1", "--fields", "{}", "--body-file", "-"], "New body.\n");
		expect(update.exitCode).toBe(0);
		expect(run(["text", "gh-1"]).stdout.toString().endsWith("---\nNew body.\n")).toBe(true);
		expect(JSON.parse(run(["fields", "gh-1", "--json"]).stdout.toString()).title).toBe("Contract 1");
		const unsupported = run(["frontier"]);
		expect(unsupported.exitCode).not.toBe(0);
		expect(unsupported.stderr.toString()).toContain("GitHub tracker: unsupported command frontier");
	}, 60_000);
});

describe("rate limit", () => {
	test("the adapter fails typed with the reset, and every process then skips gh until that reset", () => {
		setup([issue(1)]);
		const limitedUntil = Date.now() + 90_000;
		edit(state => { state.faults.limitedUntil = limitedUntil; });
		let error: unknown;
		try { tracker().snapshot(); } catch (e) { error = e; }
		expect(error).toBeInstanceOf(GithubRateLimited);
		expect((error as GithubRateLimited).resetAt).toBe(Math.ceil(limitedUntil / 1000) * 1000);
		expect(fake.calls()).toEqual(["TrackerSnapshot", "rate_limit"]);
		// A second adapter, a mutation and a REST read all stop at the recorded reset without calling gh.
		expect(() => tracker().snapshot()).toThrow(GithubRateLimited);
		expect(() => tracker().update("gh-1", { priority: 1 })).toThrow(GithubRateLimited);
		expect(() => githubRest(githubProject(cwd)!, "GET", "commits/abc")).toThrow(GithubRateLimited);
		expect(fake.calls()).toEqual(["TrackerSnapshot", "rate_limit"]);
	});

	test("a REST rate limit is the same typed hold", () => {
		setup([issue(1)]);
		edit(state => { state.faults.limitedUntil = Date.now() + 90_000; });
		expect(() => githubRest(githubProject(cwd)!, "GET", "commits/abc")).toThrow(GithubRateLimited);
		expect(fake.calls("rate_limit")).toHaveLength(1);
	});

	test("the reconciler holds until the reset, notes it once, and resumes with the real answer", async () => {
		setup([issue(1), issue(2)]);
		const limitedUntil = Date.now() + 1_500;
		edit(state => { state.faults.limitedUntil = limitedUntil; });
		const notes: string[] = [];
		const began = Date.now();
		const size = await untilReset(() => tracker().snapshot().size, { note: line => notes.push(line) });
		expect(size).toBe(2);
		expect(Date.now() - began).toBeGreaterThanOrEqual(limitedUntil - began);
		expect(notes).toHaveLength(1);
		// One rejected observation, then exactly one after the reset: nothing polled during the hold.
		expect(fake.calls("TrackerSnapshot")).toHaveLength(2);
		expect(fake.calls("rate_limit")).toHaveLength(1);
		await expect(untilReset(() => { throw new Error("not a rate limit"); })).rejects.toThrow("not a rate limit");
	}, 30_000);
});
