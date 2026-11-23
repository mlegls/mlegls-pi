// Disposable Git worktrees, real vault tracker and foreground reconciler, offline BB turns.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { load, saveState, type State } from "../../../lib/reconcile/reconcile";
import { stop } from "../../../lib/reconcile/main";

const owner = "thr_fixture", cli = join(import.meta.dir, "../../../lib/reconcile/main.ts");
const modes = ["create", "stop", "promote"];
const selected = process.argv[2];
if (selected && !modes.includes(selected)) throw new Error("Usage: bun replay.ts [create|stop|promote]");
for (const mode of modes.filter(m => !selected || selected === m)) {
	const f = protocolFixture();
	const worker = { ...f.worker("root-refine-1"), run: "root" };
	const state = () => load(f.cwd, "root")!;
	let processRun: ReturnType<typeof Bun.spawn> | undefined;
	try {
		f.bb.addThread(owner);
		f.bb.addThread(worker.bb, worker.path, "root/" + worker.handle);
		mkdirSync(join(f.root, "agents/roles"), { recursive: true });
		writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nImplement the fixture.\n");
		writeFileSync(join(f.root, "agents/roles/implement.md"), "Implement.\n");
		f.tracker.update("root", { assignee: "agent:shell" });
		const run: State = { ...f.state, backend: "threads", owner, budget: 1, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 1, log: [],
			collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } },
			chains: { root: { into: f.cwd, self: false, phase: "refine", retries: {}, workers: [], handle: worker, refinement: worker.handle } },
			refinements: { [worker.handle]: { node: "root", handle: worker.handle, worker, phase: "writing" } } };
		saveState(run);
		const before = f.git(f.cwd, "rev-parse", "HEAD:docs/issues");
		const base = f.git(f.collector, "rev-parse", "HEAD");
		const propose = (path: string, fields: string, body = "") =>
			f.commit(worker.path, ".reconcile/proposal/" + path + ".md", "---\n" + fields + "\n---\n" + body);
		if (mode === "promote") propose("parent", "decompose: false");
		else {
			propose("children/consumer", "stage: ready\npart-of: root\nassignee: agent:shell\nblocked-by: [provider]", "Use the interface.\n");
			f.commit(worker.path, "stub.ts", "export interface Stub {}\n");
			propose("children/provider", "stage: ready\npart-of: root\nassignee: agent:shell", "Implement the interface.\n");
			propose("parent", "stage: null");
		}
		assert.deepEqual([...f.tracker.snapshot().keys()], ["root"]);
		if (mode === "stop") {
			await stop(f.cwd, "root");
			assert.equal(state().refinements[worker.handle].phase, "removed");
			assert.equal(f.git(f.cwd, "rev-parse", "HEAD:docs/issues"), before);
			assert.equal(f.git(f.cwd, "status", "--porcelain", "--", "docs/issues"), "");
			console.log("stop: writer retired; tracker tree unchanged:", before);
			continue;
		}
		f.bb.completeTurn(worker.path, "done\n\n```json\n" +
			JSON.stringify({children: mode === "create" ? ["consumer", "provider"] : []}) + "\n```");
		const wrapper = join(f.root, "tracker.ts");
		writeFileSync(wrapper, [
			"const args = process.argv.slice(2);",
			"const result = Bun.spawnSync([process.execPath, process.env.REAL_TRACKER!, ...args], {stdin:Bun.stdin, stdout:'inherit', stderr:'inherit'});",
			"if (result.success && args[0] === 'create' && args[1] === 'provider') process.kill(process.ppid, 'SIGKILL');",
			"process.exit(result.exitCode);",
		].join("\n"));
		const launch = (cut: boolean) => processRun = Bun.spawn([process.execPath, cli, "run", "root", "--cwd", f.cwd, "--owner", owner, "--budget", "1", "--quiet"], {
			env: { ...process.env, PI_RECONCILE_TICK_MS: "100", ...(cut ? { REAL_TRACKER: process.env.TRACKER_CLI, TRACKER_CLI: wrapper } : {}) },
			stdout: "inherit", stderr: "inherit",
		});
		const until = async (read: () => boolean, label: string) => {
			for (const end = Date.now() + 60_000; Date.now() < end; await Bun.sleep(80)) {
				if (read()) return;
				if (processRun?.exitCode != null || processRun?.signalCode) break;
			}
			throw new Error(label + ": " + JSON.stringify(state().log.slice(-8)));
		};
		if (mode === "create") {
			launch(true);
			await until(() => processRun?.signalCode === "SIGKILL", "first creation");
			await processRun!.exited;
			assert.deepEqual(state().refinements[worker.handle].acceptance?.created, {});
			assert.deepEqual([...f.tracker.snapshot().keys()].sort(), ["provider", "root"]);
			console.log("SIGKILL after provider was published and before its receipt was saved");
		}
		launch(false);
		const target = mode === "create" ? "provider" : "root";
		await until(() => state().chains[target]?.phase === "implement" && !!state().chains[target]?.handle, "implement launch");
		const receipt = state().refinements[worker.handle];
		assert.equal(receipt.phase, "accepted");
		assert.deepEqual(state().exceptions, {});
		assert.equal(f.git(state().chains[target].handle!.path, "rev-parse", "HEAD"), f.git(f.collector, "rev-parse", "HEAD"));
		if (mode === "create") {
			assert.deepEqual(receipt.acceptance?.created, { provider: "provider", consumer: "consumer" });
			for (const slug of ["provider", "consumer"]) {
				assert.equal(f.tracker.fields(slug)["claimed-by"], "reconcile:root");
				assert.equal(f.git(f.cwd, "log", "--diff-filter=A", "--format=%s", "--", "docs/issues/" + slug + ".md"), "tracker: create " + slug);
			}
			assert.deepEqual(f.tracker.fields("consumer")["blocked-by"], ["provider"]);
			assert.deepEqual(f.git(f.collector, "log", "--format=%s", base + "..HEAD").split("\n"), ["stub.ts"]);
			assert.equal(f.git(f.collector, "show", "HEAD:stub.ts"), "export interface Stub {}");
			assert.equal(f.git(f.collector, "log", "--format=%H", "HEAD", "--", ".reconcile/proposal"), "");
			console.log("restart: provider and consumer accepted once; provider launched from stripped interface");
		} else {
			assert.equal(f.tracker.fields("root").decompose, false);
			assert.equal(f.git(f.collector, "rev-parse", "HEAD"), base);
			console.log("promote: decompose false, unchanged collector, root implementing");
		}
	} finally {
		if (processRun && processRun.exitCode === null && !processRun.signalCode) processRun.kill();
		await processRun?.exited;
		f.close();
	}
}
