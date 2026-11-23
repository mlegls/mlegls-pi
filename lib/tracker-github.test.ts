import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getGithubTracker } from "./tracker-github.ts";
import { decodeGithubBody, encodeGithubBody } from "./tracker-github-state.ts";
import { GithubRateLimited, githubProject } from "./tracker-github-snapshot.ts";
import { githubRest } from "./tracker-github-write.ts";
import { untilReset } from "./reconcile/rate-limit.ts";
import { setupCheckout, saveRun, accepting, proposed } from "./fixtures/github-acceptance.ts";
import { installFakeGh, issue, type FakeState } from "./fixtures/fake-github.ts";

// The adapter against a stateful fake of GitHub (lib/fixtures/fake-github.ts, serving reads through the committed
// docs/attachments/read-github-tracker-snapshots/fake-gh.ts): no network, no live repository.
let dir: string, cwd: string, fake: ReturnType<typeof installFakeGh>;
let savedRun: string | undefined;

function setup(issues: Record<string, any>[]) {
	({ cwd, fake } = setupCheckout(dir, issues));
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

describe("ownership and refinement acceptance", () => {
	beforeEach(() => {
		setup([
			issue(1), issue(2, { parentId: "I-1" }),
			issue(3, { assignees: [{ id: "U-viewer", login: "reader" }] }),
			issue(4, { assignees: [{ id: "U-other", login: "someone" }] }),
		]);
		saveRun(cwd, "r1"); saveRun(cwd, "r2");
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

	test("only a landed proposal creates claimed children; replay correlates per parent", () => {
		const claim = "reconcile:r1", first = proposed("base", "gh-1"), next = proposed("next", "gh-1", ["base"]);
		const create = (child = first, fields = {}, body = child.body) => tracker("r1").create({ slug: child.alias,
			fields: { ...child.fields, "claimed-by": claim, ...fields }, body });
		const attempt = accepting(cwd, "gh-1", [first, next]);
		const save = (patch = {}) => saveRun(cwd, "r1", { h1: { ...attempt, ...patch } });
		expect(create).toThrow(/landed accepting proposal/);
		for (const patch of [{ phase: "writing" }, { node: "gh-2" }, { acceptance: { ...attempt.acceptance, landedHead: undefined } }]) {
			save(patch);
			expect(create).toThrow(/landed accepting proposal/);
		}
		save();
		expect(() => create(first, { "claimed-by": claim + "/h1" })).toThrow(/landed accepting proposal/);
		expect(() => create(first, {}, "Changed body")).toThrow(/landed accepting proposal/);
		edit(state => { state.faults.lose = ["createIssue"]; });
		expect(create).toThrow();
		expect(tracker().snapshot().get("gh-5")).toMatchObject({ partOf: "gh-1", claims: [{ slug: "gh-5", claimedBy: claim }] });
		const id = create();
		expect(id).toBe("gh-5");
		expect(fake.calls("createIssue")).toHaveLength(1);
		attempt.acceptance.created.base = id;
		save();
		const dependent = create(next, { "blocked-by": [id] });
		expect(tracker().snapshot().get(dependent)).toMatchObject({ partOf: "gh-1", blockedBy: [id] });
		const other = proposed("base", "gh-2");
		saveRun(cwd, "r1", { h1: attempt, h2: accepting(cwd, "gh-2", [other]) });
		expect(create(other)).toBe("gh-7");
		expect(create()).toBe(id);
		expect(fake.calls("createIssue")).toHaveLength(3);
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
