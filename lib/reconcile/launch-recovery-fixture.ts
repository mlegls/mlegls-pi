// Restart the real reconciler at the Git worktree-add boundary. BB uses a local stand-in.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";
import { load } from "./reconcile";
import { until } from "./setup-fixture";
import { excludeTracker } from "../thread/tracker-worktree";

export const scenarios = ["raw", "ahead", "occupied"] as const;

export async function replay(mode: typeof scenarios[number]) {
	const f = protocolFixture(), owner = "thr_owner", handle = "root-implement-1";
	const path = join(f.cwd + "__worktrees", handle), calls = join(f.root, "adds");
	const state = () => load(f.cwd, "root");
	let child: ReturnType<typeof Bun.spawn> | undefined;
	try {
		mkdirSync(join(f.root, "agents/roles"), { recursive: true });
		writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nOffline worker.\n");
		writeFileSync(join(f.root, "agents/roles/implement.md"), "Offline worker.\n");
		f.tracker.update("root", { stage: "ticket", assignee: "agent:shell" });
		f.bb.addThread(owner);
		const bin = join(f.root, "bin");
		mkdirSync(bin);
		writeFileSync(join(bin, "git"),
			'#!/bin/sh\nset -eu\n' +
			'if [ "$#" -ge 7 ] && [ "$3 $4 $5 $6 $7" = "worktree add --no-checkout -b root-implement-1" ]; then\n' +
			'  "$RECOVERY_GIT" "$@"\n  echo "$8" >> "$RECOVERY_ADDS"\n' +
			'  if [ "$RECOVERY_CUT" = 1 ]; then kill -KILL "$PPID"; fi\n' +
			'else exec "$RECOVERY_GIT" "$@"; fi\n', { mode: 0o755 });
		const launch = (cut: boolean) => child = Bun.spawn([process.execPath, join(import.meta.dir, "main.ts"),
			"run", "root", "--owner", owner, "--budget", "1", "--cwd", f.cwd, "--quiet"], {
			env: { ...process.env, PATH: bin + ":" + process.env.PATH, PI_RECONCILE_TICK_MS: "100",
				RECOVERY_GIT: Bun.which("git")!, RECOVERY_ADDS: calls, RECOVERY_CUT: cut ? "1" : "0" },
			stdout: "inherit", stderr: "inherit",
		});
		const first = launch(true);
		await until(() => first.signalCode || first.exitCode !== null);
		assert.equal(first.signalCode, "SIGKILL");
		assert.equal(state()?.chains.root.launching, handle);
		assert.deepEqual(readdirSync(path), [".git"]);
		assert.deepEqual(f.bb.threads().map(t => t.id), [owner]);

		let ahead: string | undefined, advanced: string | undefined;
		const marker = join(path, ".wm", "retained");
		if (mode === "ahead") {
			// Also exercise recovery of a later interruption, after preparation committed work.
			f.git(path, "config", "branch." + handle + ".ab-parent", "main");
			excludeTracker(path);
			ahead = f.commit(path, "retained.txt", "keep this commit\n");
			advanced = f.commit(f.cwd, "new-base.txt", "the launch base moved\n");
			mkdirSync(join(path, ".wm"));
			writeFileSync(marker, "keep this checkout\n");
		} else if (mode === "occupied") f.git(path, "branch", "-m", "foreign");

		const occupant = () => ({ branch: f.git(path, "branch", "--show-current"), head: f.git(path, "rev-parse", "HEAD"), entries: readdirSync(path).sort() });
		const before = mode === "occupied" ? occupant() : undefined;
		const restarted = launch(false);
		await until(() => restarted.exitCode !== null || state()?.chains.root.handle || state()?.exceptions.root?.mailed);
		const result = state()!, worker = result.chains.root.handle;
		if (mode === "occupied") {
			assert.match(result.exceptions.root.text, /expected a linked worktree on the saved launch branch/);
			assert.equal(f.git(path, "branch", "--show-current"), "foreign");
			assert.equal(worker, undefined);
		} else {
			assert.deepEqual(result.exceptions, {});
			assert.equal(worker?.handle, handle);
			assert.equal(worker?.path, path);
			assert.equal(result.chains.root.launching, undefined);
			assert.equal(f.git(path, "status", "--porcelain"), "");
			if (ahead) {
				for (const tip of [ahead, advanced!]) f.git(path, "merge-base", "--is-ancestor", tip, "HEAD");
				assert.ok(existsSync(marker));
			}
		}
		assert.deepEqual(readFileSync(calls, "utf8").trim().split("\n"), mode === "raw" ? [path, path] : [path]);
		assert.equal(f.bb.threads().filter(t => t.title === "root/" + handle).length, mode === "occupied" ? 0 : 1);
		return { interrupted: first.signalCode, handle, worker: worker?.handle, adoptedCommit: ahead, occupant: before && { before, after: occupant() }, hold: result.exceptions.root?.reason, log: result.log };
	} catch (error) {
		console.error(state()?.log.join("\n"));
		throw error;
	} finally {
		if (child && child.exitCode === null && !child.signalCode) child.kill();
		await child?.exited;
		f.close();
	}
}

if (import.meta.main) {
	const mode = scenarios.find(s => s === process.argv[2]);
	if (!mode) throw new Error("Choose raw, ahead or occupied");
	console.log(JSON.stringify(await replay(mode), null, 2));
}
