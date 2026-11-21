// First-use fixture: real reconciler CLI, disposable Git repo, fake BB threads.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stop } from "../../../lib/reconcile/main";
import { load, saveState, stateDir, type State } from "../../../lib/reconcile/reconcile";
import { reviewedResult } from "../../../lib/reconcile/completion";
import { fakeBb } from "../../../lib/thread/fake-bb";

const source = resolve(import.meta.dir, "../../..");
const root = realpathSync(mkdtempSync(join(tmpdir(), "rc-integrate-lock-")));
const repo = join(root, "repo"), scratch = join(root, "scratch");
const issues = ["fresh", "resuming", "recovering"] as const;
const runs = new Map<string, Bun.Subprocess>();
const owner = "thr_fixture";
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

try {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|PI_RECONCILE_.*|AB_THREAD_ID|BB_.*|FAKE_BB_.*|TMUX.*|WORKER_.*)$/.test(key)) delete process.env[key];
	Object.assign(process.env, {
		XDG_STATE_HOME: join(root, "state"), PI_CODING_AGENT_DIR: join(root, "agent"),
		PI_AGENTS_DIR: join(root, "agents"), PI_RECONCILE_TICK_MS: "100",
		TRACKER_CLI: join(source, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts"),
	});
	const bb = fakeBb(root);
	bb.addThread(owner);
	for (const dir of [join(repo, "docs/issues"), join(root, "agents/roles")]) mkdirSync(dir, { recursive: true });
	writeFileSync(join(root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
	writeFileSync(join(root, "agents/roles/implement.md"), "Shell fixture.\n");
	git(repo, "init", "-qb", "main");
	git(repo, "config", "user.name", "Fixture");
	git(repo, "config", "user.email", "fixture@example.invalid");
	for (const issue of issues) writeFileSync(join(repo, "docs/issues", issue + ".md"), "---\nstage: ticket\nassignee: agent:shell\n---\n\nContention fixture.\n");
	git(repo, "add", "."); git(repo, "commit", "-qm", "Fixture tickets");
	const before = git(repo, "rev-parse", "HEAD");
	writeFileSync(join(repo, "delivered.txt"), "Already merged; ledger write interrupted.\n");
	git(repo, "add", "."); git(repo, "commit", "-qm", "Delivered code");
	const preparedHead = git(repo, "rev-parse", "HEAD");
	const branch = "resuming-implement-1";
	git(repo, "worktree", "add", "-qb", branch, scratch);
	writeFileSync(join(scratch, "kept.txt"), "Work from the stopped worker.\n");
	git(scratch, "add", "."); git(scratch, "commit", "-qm", "Kept work");
	const kept = git(scratch, "rev-parse", "HEAD");
	git(repo, "worktree", "remove", scratch);

	const seed = (slug: string): State => ({ backend: "threads", root: slug, cwd: repo, owner, budget: 1,
		landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {}, chains: {}, exceptions: {},
		tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
	saveState({ ...seed("resuming"), finished: "stopped", counter: 1, resume: { resuming: { phase: "implement", branch, head: kept } } });
	const worker = { run: "recovering", handle: "recovering-review-1", path: join(root, "retired-reviewer") };
	saveState({ ...seed("recovering"), landingOps: { recovering: { slug: "recovering", into: repo, destination: repo,
		before, preparedHead, worker, workers: [], carried: [], result: reviewedResult(null, {}, "Fixture delivery.") } } });
	const lock = join(stateDir(repo), "integrate.lock");
	mkdirSync(lock);
	writeFileSync(join(lock, "pid"), String(process.pid));
	console.log("Ready: fixture repo and live integrate lock", { repo, lockHolder: process.pid, kept, preparedHead });

	for (const issue of issues) runs.set(issue, Bun.spawn([process.execPath, join(source, "lib/reconcile/main.ts"),
		"run", issue, "--cwd", repo, "--owner", owner, "--budget", "1", "--land", "local", "--quiet"],
		{ env: { ...process.env }, stdout: "inherit", stderr: "inherit" }));
	const workerFor = (issue: string) => {
		const handle = load(repo, issue)?.chains[issue]?.handle;
		return handle && bb.threads().some(thread => thread.environment === handle.path) ? handle : undefined;
	};
	const until = async (ready: () => boolean, ms: number) => {
		const deadline = Date.now() + ms;
		while (!ready() && Date.now() < deadline) await Bun.sleep(100);
	};
	// Hold longer than one lock poll even if both workers launch immediately.
	await Bun.sleep(2200);
	await until(() => !!workerFor("fresh") && !!workerFor("resuming"), 12_000);
	const resumed = workerFor("resuming");
	console.log("Lock held", { freshWorker: workerFor("fresh")?.handle, resumedWorker: resumed?.handle,
		resumedHead: resumed && git(resumed.path, "rev-parse", "HEAD"), pendingRunPid: load(repo, "recovering")?.pid,
		recovered: load(repo, "recovering")?.landed.recovering ?? null });

	rmSync(lock, { recursive: true });
	await until(() => !!load(repo, "recovering")?.landed.recovering, 12_000);
	console.log("Lock released", { recovered: load(repo, "recovering")?.landed.recovering ?? null });
} finally {
	for (const child of runs.values()) if (child.exitCode === null) child.kill();
	await Promise.all([...runs.values()].map(child => child.exited));
	try {
		for (const issue of runs.keys()) if (load(repo, issue)) await stop(repo, issue);
	} finally { rmSync(root, { recursive: true, force: true }); }
}
