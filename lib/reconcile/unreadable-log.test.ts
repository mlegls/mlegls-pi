import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeBb } from "../thread/fake-bb";
import { start, stop } from "./main";
import { load } from "./reconcile";

// Real reconciler process and worker setup on a fake bb CLI whose event responses have a (scaled-down) size limit, as
// bb's 8 MiB one: 2026-11-06 (concept), a finished implementer's log outgrew it and its chain sat in implement for 14h.
const packagePath = realpathSync(join(import.meta.dir, "../.."));
async function until<T>(read: () => T | undefined | false, ms = 40_000): Promise<T> {
	for (let i = 0; i < ms / 100; i++) { const value = read(); if (value) return value; await Bun.sleep(100); }
	throw new Error("timed out");
}

async function fixture(body: (o: { repo: string; bb: ReturnType<typeof fakeBb> }) => Promise<void>) {
	const root = realpathSync(mkdtempSync("/tmp/rc-biglog-")), saved = { ...process.env };
	const repo = join(root, "repo");
	const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
	let running = false;
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|FAKE_BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"),
			PI_CODING_AGENT_DIR: join(root, "agent"), PI_AGENTS_DIR: join(root, "agents"), MISE_TRUSTED_CONFIG_PATHS: root,
			PI_RECONCILE_TICK_MS: "100", PI_RECONCILE_UNREADABLE_MS: "1500",
			TRACKER_CLI: join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts") });
		const bb = fakeBb(root);
		bb.addThread("thr_solo");
		for (const dir of [repo, join(root, "agents/roles"), join(repo, "docs/issues")]) mkdirSync(dir, { recursive: true });
		for (const role of ["implement", "drive"]) {
			writeFileSync(join(root, "agents", role + "r.md"), "---\nrole: " + role + "\n---\nShell fixture.\n");
			writeFileSync(join(root, "agents/roles", role + ".md"), "Shell fixture.\n");
		}
		git(repo, "init", "-qb", "main"); git(repo, "config", "user.name", "Fixture"); git(repo, "config", "user.email", "fixture@example.invalid");
		writeFileSync(join(repo, "docs/issues/solo.md"), "---\nstage: ticket\nassignee: agent:implementr\n---\n\nLarge log fixture.\n");
		git(repo, "add", "."); git(repo, "commit", "-qm", "fixture");
		start({ cwd: repo, root: "solo", owner: "thr_solo", budget: 1 });
		running = true;
		await body({ repo, bb });
	} catch (error) {
		console.error(JSON.stringify({ state: load(repo, "solo") }, null, 1));
		throw error;
	} finally {
		if (running) await stop(repo, "solo");
		process.env = saved;
		rmSync(root, { recursive: true, force: true });
	}
}
const started = (bb: ReturnType<typeof fakeBb>, path: string) => bb.threads().some(t => t.environment === path);
const implementer = (repo: string, bb: ReturnType<typeof fakeBb>) => until(() => { const c = load(repo, "solo")?.chains.solo; return c?.phase === "implement" && c.handle && started(bb, c.handle.path) && c.handle; });
const driving = (repo: string, bb: ReturnType<typeof fakeBb>) => until(() => { const c = load(repo, "solo")?.chains.solo; return c?.phase === "drive" && c.handle && started(bb, c.handle.path) && c.handle; });

test("a worker's finish behind a log too large to return at once still advances its chain", () => fixture(async ({ repo, bb }) => {
	const first = await implementer(repo, bb);
	// A long turn's work, one event of it over the limit alone, then the finish; a whole-log read is refused.
	bb.padLog(first.path, [...Array(400).fill(200), 50_000, ...Array(50).fill(200)]);
	bb.limitLog(first.path, 20_000);
	bb.completeTurn(first.path, "done\n\nImplemented.");
	const drive = await driving(repo, bb);
	expect(drive.handle).not.toBe(first.handle);
	const s = load(repo, "solo")!;
	expect(s.exceptions).toEqual({});
	expect(s.log.some(l => l.includes("skipped an event of " + first.handle + "'s log") && l.includes("too large"))).toBe(true);
	expect(s.log.some(l => l.includes("reading " + first.handle + " failed"))).toBe(false);
	// Polls page from the last seq seen, never the whole log.
	expect(bb.calls().some(c => c[1] === "log" && c.includes("--all"))).toBe(false);
}), 90_000);

test("a worker log that can't be read is raised to the owner, and withdrawn once it reads again", () => fixture(async ({ repo, bb }) => {
	const first = await implementer(repo, bb);
	bb.failLog(first.path, "HTTP 500: event store unavailable");
	const ex = await until(() => load(repo, "solo")?.exceptions.solo);
	expect(ex).toMatchObject({ reason: "implement worker log unreadable", level: "owner" });
	expect(ex.text).toContain("HTTP 500: event store unavailable");
	await until(() => bb.threads().find(t => t.id === "thr_solo")!.tells.some(b => b.includes("needs you: solo — implement worker log unreadable")));
	expect(load(repo, "solo")!.log.filter(l => l.includes("reading " + first.handle + " failed")).length).toBe(1);

	bb.failLog(first.path, undefined);
	bb.completeTurn(first.path, "done\n\nImplemented.");
	await driving(repo, bb);
	expect(load(repo, "solo")!.exceptions).toEqual({});
}), 90_000);
