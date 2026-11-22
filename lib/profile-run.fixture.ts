// Offline first use: bun lib/profile-run.fixture.ts alpha (or beta), optionally --json.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const epoch = Date.parse("2026-01-01T00:00:00Z");
const at = (s: number) => new Date(epoch + s * 1000).toISOString();
const reply = (s: number, total: number) => ({ type: "message", timestamp: at(s), message: {
	role: "assistant", timestamp: epoch + s * 1000 - 1000, model: "fixture", usage: { cost: { total } },
} });
const usage = (s: number, total: number) => ({ type: "usage", timestamp: at(s), model: "fixture", usage: { cost: { total } } });

export function runFixture(slug: string, ...flags: string[]): string {
	const dir = mkdtempSync(join(tmpdir(), "profile-run-"));
	try {
		const sessions = join(dir, "sessions", "fixture");
		mkdirSync(sessions, { recursive: true });
		const thread = "thr_run_fixture";
		const file = (id: string) => join(sessions, "session_" + id + ".jsonl");
		const session = (id: string, s: number, entries: object[], parentSession?: string) => {
			writeFileSync(file(id), [{ type: "session", id, timestamp: at(s), cwd: dir, parentSession }, ...entries].map(e => JSON.stringify(e)).join("\n"));
			const mtime = Date.now() / 1000 + s;
			utimesSync(file(id), mtime, mtime);
		};
		const meta = (s: number, data: object) => ({ type: "custom", customType: "session-meta", timestamp: at(s), data });
		const firstReplies = [reply(20, 8), reply(35, 4)];
		session("owner-first", 0, [meta(0, { thread }), ...firstReplies]);
		session("owner-fork", 40, [...firstReplies, meta(40, { thread }), reply(45, 5), reply(70, 7)], file("owner-first"));
		session("owner-latest", 90, [meta(90, { thread }), { type: "message", timestamp: at(120), message: { role: "user", content: "Later turn" } }]);
		session("worker-alpha-a", 10, [meta(10, { run: "alpha", handle: "a", parentSession: "owner-first" }), reply(55, 2), usage(60, 1)]);
		session("worker-alpha-b", 46, [meta(46, { run: "alpha", handle: "b", parentSession: "owner-fork" }), reply(58, 3)]);
		session("worker-beta", 30, [meta(30, { run: "beta", handle: "a", parentSession: "owner-first" }), reply(80, 5)]);
		const result = Bun.spawnSync([process.execPath, join(import.meta.dir, "profile.ts"), thread, "--run", slug, "--fast", ...flags], {
			env: { ...process.env, PI_CODING_AGENT_DIR: dir, BB_DATA_DIR: dir, BB_PI_BRIDGE_SESSION_DIR: dir, XDG_CACHE_HOME: dir, XDG_STATE_HOME: dir },
		});
		if (result.exitCode) throw new Error(result.stderr.toString());
		return result.stdout.toString();
	} finally { rmSync(dir, { recursive: true, force: true }); }
}

if (import.meta.main) {
	const [slug = "alpha", ...flags] = process.argv.slice(2);
	process.stdout.write(runFixture(slug, ...flags));
}
