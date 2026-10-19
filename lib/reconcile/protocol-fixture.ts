// Local Git/global Tracker fixture for the approved protocol regression tests.
// Registered receipts have no launched writer; no model or host service is used.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getTracker, type Fields } from "../tracker";
import { saveThread } from "../thread/registry";
import { fakeBb } from "../thread/fake-bb";
import { excludeTracker } from "../thread/tracker-worktree";
import type { GlobalRunState } from "./tracker-state";

export function protocolFixture() {
	const root = realpathSync(mkdtempSync("/tmp/rc-protocol-")), cwd = join(root, "repo");
	const saved = { ...process.env };
	for (const key of Object.keys(process.env))
		if (/^(?:PI_.*|BB_.*|AB_.*|TMUX.*|WORKER_.*|GIT_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, {
		XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
		PI_CODING_AGENT_DIR: join(root, "agent"),
		PI_AGENTS_DIR: join(root, "agents"),
		MISE_TRUSTED_CONFIG_PATHS: root, TRACKER_CLI: realpathSync(join(import.meta.dir,
			"../../skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts")),
	});
	const bb = fakeBb(root);
	const git = (path: string, ...args: string[]) => execFileSync("git", ["-C", path, ...args],
		{ encoding: "utf8", stdio: "pipe" }).trim();
	const commit = (path: string, file: string, body: string) => {
		mkdirSync(join(path, file, ".."), { recursive: true });
		writeFileSync(join(path, file), body);
		git(path, "add", "--", file); git(path, "commit", "-qm", file);
		return git(path, "rev-parse", "HEAD");
	};
	mkdirSync(join(cwd, "docs/issues"), { recursive: true });
	git(cwd, "init", "-qb", "main");
	git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
	git(cwd, "config", "commit.gpgSign", "false"); git(cwd, "config", "core.hooksPath", "/dev/null");
	commit(cwd, "code.txt", "base\n");
	const tracker = getTracker(cwd, { inflight: false }), stateFile = join(root, "run.json");
	const state: GlobalRunState = { root: "root", cwd, landed: {}, results: {}, landingOps: {}, refinements: {} };
	const create = (slug: string, fields: Fields = {}) => tracker.create({
		slug, fields: { stage: "ticket", assignee: "agent", author: "user:fixture", ...fields }, body: slug + " contract\n",
	});
	create("root", { stage: "spec" });
	const collector = join(root, "collector");
	git(cwd, "worktree", "add", "--no-checkout", "-qb", "collector", collector);
	excludeTracker(collector);
	return {
		root, cwd, collector, tracker, state, git, commit, create, bb,
		/** A registered worker with a bb thread but no worktree: its reports still arrive, as a retired worker's late ones do. */
		async bare(run: string, handle: string, path = join(root, "gone")) {
			const id = run + "-" + handle, bbId = "bbt-" + id;
			bb.addThread(bbId, path);
			await saveThread({ id, sessionId: id, sessionFile: join(root, id + ".jsonl"), cwd: path, project: cwd, ownership: "guest", archived: false,
				created: new Date().toISOString(), worker: { handle, run }, bb: bbId });
			return { handle, run, path, threadId: id };
		},
		save: (value: GlobalRunState) => writeFileSync(stateFile, JSON.stringify(value)),
		restore: (): GlobalRunState => JSON.parse(readFileSync(stateFile, "utf8")),
		async worker(handle: string, from = collector, parentBranch = "collector") {
			const path = join(root, handle), id = "protocol-" + handle, run = "protocol";
			git(cwd, "worktree", "add", "--no-checkout", "-qb", handle, path, git(from, "rev-parse", "HEAD"));
			excludeTracker(path);
			git(cwd, "config", "branch." + handle + ".ab-parent", parentBranch);
			await saveThread({ id, sessionId: id, sessionFile: join(root, id + ".jsonl"), cwd: path, project: cwd,
				worktree: path, ownership: "owner", branch: handle, archived: false, created: new Date().toISOString(),
				worker: { handle, run }, bb: "bbt-" + id });
			bb.addThread("bbt-" + id, path);
			return { handle, run, path, threadId: id };
		},
		close() { process.env = saved; rmSync(root, { recursive: true, force: true }); },
	};
}
