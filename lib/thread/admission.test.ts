import { afterAll, beforeAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readAdmission } from "./admission";
import { abandonThread } from "./lifecycle";
import { allThreads } from "./registry";
import { newThread } from "./runtime";
import { terminals, zmx } from "./zmx";

// Shell workers (no pi, no model) over an isolated GNU sem pool of one slot. Two repositories stand for two owners.
const root = realpathSync(mkdtempSync("/tmp/ab-admit-test-")); // short: zmx socket paths are length-limited
const saved = { ...process.env };
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const pressure = join(root, "pressure.json");
const probe = (freePercent: number) => writeFileSync(pressure, JSON.stringify({ freePercent, swapMB: 0 }));
const repos = { a: join(root, "a"), b: join(root, "b") };
// stty touches the terminal as pi does: a worker left in a background process group stops there, after admission
// already says running. So a worker counts as started only once its marker exists.
const shell = { cmd: 'stty -echo && touch "' + root + '/ran-$PI_WM_HANDLE"; sleep 300' };
const ran = (handle: string) => existsSync(join(root, "ran-" + handle));

async function until<T>(read: () => T | undefined | false, ms = 20_000): Promise<T> {
	for (let i = 0; i < ms / 100; i++) { const value = read(); if (value) return value; await new Promise(r => setTimeout(r, 100)); }
	throw new Error("timed out");
}
const worker = (owner: "a" | "b", handle: string) => newThread({ cwd: repos[owner], worker: { run: owner, handle }, launch: shell });

beforeAll(() => {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_THREAD_ID|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, {
		XDG_STATE_HOME: join(root, "state"), PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
		PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "1", MISE_TRUSTED_CONFIG_PATHS: root,
		WORKER_PRESSURE_PROBE: "cat " + pressure,
	});
	probe(80);
	for (const repo of Object.values(repos)) {
		mkdirSync(repo);
		git(repo, "init", "-b", "main");
		git(repo, "config", "user.name", "t");
		git(repo, "config", "user.email", "t@example.invalid");
		git(repo, "commit", "--allow-empty", "-m", "seed");
	}
});

afterAll(async () => {
	for (const t of await allThreads()) await abandonThread(t.id).catch(() => {});
	for (const t of await terminals().catch(() => [])) await zmx(["kill", t.name, "--force"]).catch(() => {});
	process.env = saved;
	rmSync(root, { recursive: true, force: true });
});

test("with one slot, a second owner's worker stays queued until the first is retired", async () => {
	const first = await worker("a", "first");
	await until(() => ran("first"));
	const second = await worker("b", "second");
	await until(() => readAdmission(second.id)?.reason === "worker slots");
	await new Promise(r => setTimeout(r, 1_500));
	expect(readAdmission(second.id)).toMatchObject({ state: "queued", reason: "worker slots" });
	expect(ran("second")).toBe(false);
	await abandonThread(first.id);
	await until(() => ran("second"));
}, 30_000);

test("a worker waits while memory pressure is high and starts once it falls", async () => {
	await abandonThread((await allThreads()).find(t => t.worker?.handle === "second" && !t.archived)!.id);
	probe(1);
	const held = await worker("a", "held");
	await until(() => readAdmission(held.id)?.reason?.startsWith("memory free"));
	await new Promise(r => setTimeout(r, 2_500));
	expect(readAdmission(held.id)).toMatchObject({ state: "queued" });
	expect(ran("held")).toBe(false);
	probe(80);
	await until(() => ran("held"));
}, 30_000);
