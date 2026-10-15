import { expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeBb } from "../thread/fake-bb.ts";
import { ROLES, installFakeGh, issue, newState } from "../fixtures/fake-github.ts";

// A production run() against the stateful fake gh (lib/fixtures/fake-github.ts) while the account's API budget is exhausted:
// the reconciler holds without mailing the owner, a worker whose tracker CLI call failed fast is sent back to retry (never
// forwarded as blocked), and a report that arrives during the hold is consumed once, after the reset.
test("run() holds on a tracker rate limit: no owner mail, a fast-failing worker retries, the pending report is replayed", async () => {
	const saved = { ...process.env }, here = process.cwd();
	const root = realpathSync(mkdtempSync("/tmp/rc-rate-")), cwd = join(root, "repo"), pkg = join(import.meta.dir, "../..");
	for (const key of Object.keys(process.env)) if (/^(?:PI_.*|BB_.*|AB_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*|FAKE_BB_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"), PI_BOARD_DIR: join(root, "board"),
		PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(pkg, "agents"), MISE_TRUSTED_CONFIG_PATHS: root, PI_RECONCILE_TICK_MS: "200",
		TRACKER_CLI: join(pkg, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts") });
	const git = (path: string, ...args: string[]) => execFileSync("git", ["-C", path, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	const notes: string[] = [], log = console.log;
	console.log = (...args: unknown[]) => { notes.push(args.join(" ")); };
	const abort = new AbortController();
	let fake: ReturnType<typeof installFakeGh> | undefined, running: Promise<unknown> | undefined;
	try {
		fakeBb(root);
		mkdirSync(join(cwd, "docs/agents"), { recursive: true });
		git(root, "init", "-qb", "main", cwd);
		git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
		git(cwd, "config", "commit.gpgSign", "false"); git(cwd, "config", "core.hooksPath", "/dev/null");
		git(cwd, "remote", "add", "origin", "https://github.com/fixture/tracker.git");
		writeFileSync(join(cwd, "docs/agents/issue-tracker.md"), "# Issue tracker: GitHub\nRepository: fixture/tracker\n");
		writeFileSync(join(cwd, "docs/agents/triage-labels.md"), ["| Role | Label |", "| --- | --- |", ...ROLES.map(role => "| " + role + " | " + role + " |")].join("\n"));
		git(cwd, "add", "."); git(cwd, "commit", "-qm", "base");
		fake = installFakeGh(join(root, "bin"), newState([issue(1)]));
		const { getGithubTracker } = await import("../tracker-github.ts");
		const { githubProject, rateLimitMark } = await import("../tracker-github-snapshot.ts");
		const { run, load } = await import("./reconcile.ts");
		const { readFrom, send } = await import("../board/store.ts");
		const { topic } = await import("../dispatch.ts");
		const tracker = getGithubTracker(cwd, {})!, project = githubProject(cwd)!;
		const id = tracker.create({ slug: "leaf", fields: { title: "Leaf", stage: "ticket", assignee: "agent", author: "user:fixture" }, body: "Leaf contract.\n" });
		const state = () => load(cwd, id)!;
		const until = async <T>(fn: () => T | false | undefined, label: string, ms = 60_000): Promise<T> => {
			for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) { const value = fn(); if (value) return value; }
			throw new Error("timeout: " + label + "\n" + notes.slice(-12).join("\n"));
		};
		const limitFile = join(project.directory, "rate-limit.json");
		// The account's budget runs out for a few seconds; the adapter's one-minute cache would otherwise hide it from the next tick.
		const exhaust = async (ms: number) => {
			const next = fake!.read(); next.faults.limitedUntil = Date.now() + ms; fake!.write(next);
			if (existsSync(join(project.directory, "snapshot.json"))) unlinkSync(join(project.directory, "snapshot.json"));
			const resetAt = await until(() => { try { const at = JSON.parse(readFileSync(limitFile, "utf8")).resetAt; return at > Date.now() && at; } catch { return false; } }, "the reconciler meets the limit");
			return resetAt as number;
		};
		const owned = () => readFrom(0).messages.filter(m => m.body.startsWith("[reconcile " + id + "]")).map(m => m.body);
		const holds = () => notes.filter(line => line.startsWith("tracker rate limit: holding every node"));
		const report = (h: { run: string; handle: string }, status: string, extra: unknown = {}) => send({ from: {}, topic: h.run + "/" + h.handle, tags: [status],
			body: status + "\n\n" + "```json\n" + JSON.stringify(extra) + "\n```" });
		const cli = (h: { path: string; run: string }, ...args: string[]) => spawnSync("bun", [process.env.TRACKER_CLI!, ...args], { cwd: h.path, encoding: "utf8", env: { ...process.env, PI_WM_RUN: h.run } });

		running = run({ cwd, root: id, owner: "mail/ratelimit", budget: 1, land: "local", signal: abort.signal });
		running.catch(() => {});
		let h = (await until(() => state().chains[id]?.phase === "implement" && state().chains[id].handle && existsSync(state().chains[id].handle!.path) && state().chains[id].handle, "implement worker launched"));

		// 1. The limit hits while an implementer is running. Its tracker CLI call fails fast; it gives up and reports blocked.
		const reset = await exhaust(4_000);
		const began = Date.now(), failed = cli(h, "update", id, "--fields", JSON.stringify({ priority: 2 }));
		expect(failed.status).not.toBe(0);
		expect(failed.stderr).toContain(rateLimitMark);
		expect(Date.now() - began).toBeLessThan(3_000);
		const blocked = report(h, "blocked", { question: "tracker CLI failed: " + failed.stderr.trim() });
		const nudge = await until(() => readFrom(0).messages.find(m => m.topic === topic(h) && m.body.includes("rate limit is a hold, not a blocker")), "worker sent back to retry");
		expect(Date.parse(nudge.ts)).toBeGreaterThanOrEqual(reset);          // answered after the reset, not forwarded and not dropped
		expect(Date.parse(nudge.ts)).toBeGreaterThan(Date.parse(blocked.ts));
		expect(state().exceptions).toEqual({});
		expect(state().chains[id].phase).toBe("implement");
		expect(state().chains[id].handle).toEqual(h);
		expect(cli(h, "update", id, "--fields", JSON.stringify({ priority: 2 })).status).toBe(0);   // the retry succeeds after the reset

		// 2. A done report posted during a second hold stays unconsumed until the reset, then moves the chain on exactly once.
		const second = await exhaust(4_000);
		writeFileSync(join(h.path, "evidence.md"), "# leaf\n"); git(h.path, "add", "."); git(h.path, "commit", "-qm", "leaf");
		const done = report(h, "done", { summary: "leaf", setup: { kind: "fixture" }, stories: [{ story: "leaf", outcome: "held" }], evidence: { path: "evidence.md", visual: false, shots: [] }, tests: [] });
		await Bun.sleep(1_500);
		expect(Date.now()).toBeLessThan(second);
		expect(state().chains[id].phase).toBe("implement");                  // pending: the hold stopped the tick before it consumed the report
		const drive = await until(() => state().chains[id]?.phase === "drive" && state().chains[id].handle, "report replayed after the reset");
		expect(state().chains[id].launchedAt).toBeGreaterThanOrEqual(second);   // consumed after the reset, not during it
		expect(drive.handle).toContain("drive");
		expect(Date.parse(done.ts)).toBeLessThan(second);

		// Neither hold reached the owner or became an exception; each was noted once.
		expect(owned()).toEqual(["[reconcile " + id + "] started (budget 1)"]);
		expect(holds()).toHaveLength(2);
		expect(notes.filter(line => line.startsWith("tick failed"))).toEqual([]);
		expect(state().exceptions).toEqual({});
	} finally {
		console.log = log;
		abort.abort();
		await running?.catch(() => {});
		fake?.restore();
		process.chdir(here);
		process.env = saved;
		rmSync(root, { recursive: true, force: true });
	}
}, 120_000);
