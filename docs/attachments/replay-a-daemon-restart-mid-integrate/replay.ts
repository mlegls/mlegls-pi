// Crash the real foreground reconciler at Git/tracker boundaries in a disposable repo.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { load, saveState, stateDir, type State } from "../../../lib/reconcile/reconcile";
import { beginRefinement } from "../../../lib/reconcile/refinement";

const cli = resolve(import.meta.dir, "../../../lib/reconcile/main.ts");
const owner = "thr_owner";
const cases = ["plain", "decompose"] as const;
const selector = process.argv[2];
if (selector && !cases.some(mode => mode === selector)) throw new Error("Usage: bun replay.ts [plain|decompose]");

for (const mode of cases.filter(mode => !selector || mode === selector)) {
	const f = protocolFixture(), decompose = mode === "decompose";
	const state = () => load(f.cwd, "root")!;
	const dir = stateDir(f.cwd), pidFile = join(dir, "root.lock", "pid");
	const merges = join(f.root, "post-merge"), closed = join(f.root, "closed"), hooks = join(f.root, "hooks");
	let child: ReturnType<typeof Bun.spawn> | undefined;
	try {
		f.bb.addThread(owner);
		const worker = { ...f.worker(decompose ? "root-refine-1" : "root-review-1", decompose ? f.collector : f.cwd, decompose ? "collector" : "main"), run: "root" };
		f.bb.addThread(worker.bb, worker.path, "root/" + worker.handle);
		const target = decompose ? f.collector : f.cwd;
		const s: State = { ...f.state, backend: "threads", owner, budget: 1, exceptions: {}, collectors: {}, tests: {}, resolved: {}, moved: {}, counter: 1, log: [],
			chains: { root: { into: f.cwd, self: false, phase: decompose ? "refine" : "review", retries: {}, workers: [], handle: worker } } };
		let handoff: object;
		let head: string;
		if (decompose) {
			s.collectors.root = { path: f.collector, branch: "collector", parentBranch: "main" };
			const attempt = beginRefinement({ state: s, tracker: f.tracker, save: () => saveState(s), locked: async work => work() }, "root", worker.handle);
			attempt.worker = worker;
			s.chains.root.refinement = worker.handle;
			mkdirSync(join(f.root, "agents/roles"), { recursive: true });
			writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nFixture agent.\n");
			writeFileSync(join(f.root, "agents/roles/implement.md"), "Fixture role.\n");
			head = f.commit(worker.path, "stub.ts", "export interface Stub {}\n");
			f.commit(worker.path, ".reconcile/proposal/children/part.md", "---\nstage: ready\npart-of: root\nassignee: agent:shell\n---\nUse the stub.\n");
			f.commit(worker.path, ".reconcile/proposal/parent.md", "---\nstage: null\n---\n");
			handoff = { children: ["part"] };
		} else {
			f.tracker.update("root", { stage: "ready", decompose: null });
			f.git(worker.path, "reset", "--hard", "main");
			const path = "docs/attachments/review/index.md";
			head = f.commit(worker.path, path, "Reviewed fixture delivery.\n");
			handoff = { summary: "Review turn preserved", stories: [{ story: "Fixture delivery", outcome: "held" }], evidence: { path, visual: false, shots: [] } };
		}
		const before = f.git(f.cwd, "rev-parse", "HEAD");
		saveState(s);
		const report = "done\n\n```json\n" + JSON.stringify(handoff) + "\n```";
		f.bb.completeTurn(worker.path, report);

		// Cut after the actual fast-forward, before integration returns to save its landed receipt.
		mkdirSync(hooks);
		writeFileSync(join(hooks, "post-merge"), "#!/bin/sh\nset -eu\ngit rev-parse HEAD >> \"$REPLAY_MERGES\"\n[ \"$(wc -l < \"$REPLAY_MERGES\")\" -ne 1 ] || kill -KILL \"$(cat \"$REPLAY_PID\")\"\n", { mode: 0o755 });
		f.git(f.cwd, "config", "core.hooksPath", hooks);

		// On the plain replay, cut again after the real tracker closes the issue, while the chain still exists.
		const tracker = join(f.root, "tracker.ts");
		writeFileSync(tracker, "import { existsSync, readFileSync, writeFileSync } from 'node:fs';\n" +
			"const env = process.env, args = process.argv.slice(2);\n" +
			"const result = Bun.spawnSync([process.execPath, env.REPLAY_TRACKER, ...args], { stdin: Bun.stdin, stdout: 'inherit', stderr: 'inherit' });\n" +
			"if (result.success && args[0] === 'close' && args[1] === 'root' && !existsSync(env.REPLAY_CLOSED)) {\n" +
			"  const pid = Number(readFileSync(env.REPLAY_PID, 'utf8'));\n" +
			"  if (pid !== process.ppid) throw new Error('Close is not from the replay reconciler');\n" +
			"  writeFileSync(env.REPLAY_CLOSED, String(pid)); process.kill(pid, 'SIGKILL');\n" +
			"}\nprocess.exit(result.exitCode);\n");
		const launch = () => child = Bun.spawn([process.execPath, cli, "run", "root", "--owner", owner, "--budget", "1", "--cwd", f.cwd, "--quiet"], {
			env: { ...process.env, PI_RECONCILE_TICK_MS: "100", REPLAY_PID: pidFile, REPLAY_MERGES: merges, REPLAY_CLOSED: closed,
				REPLAY_TRACKER: process.env.TRACKER_CLI!, ...(!decompose ? { TRACKER_CLI: tracker } : {}) },
			stdout: "inherit", stderr: "inherit",
		});
		const wait = async (read: () => boolean, label: string) => {
			for (const deadline = Date.now() + 60_000; Date.now() < deadline; await Bun.sleep(50)) {
				if (read()) return;
				if (child!.exitCode !== null || child!.signalCode) break;
			}
			throw new Error("Did not reach " + label);
		};
		const killed = async (label: string) => {
			await wait(() => child!.signalCode === "SIGKILL", label);
			await child!.exited;
		};
		const retired = () => !!f.bb.threads().find(t => t.id === worker.bb)?.archivedAt && !existsSync(worker.path)
			&& !f.git(f.cwd, "branch", "--list", worker.handle);
		launch();
		await killed("post-merge kill");
		assert.equal(f.git(target, "rev-parse", "HEAD"), head);
		assert.ok(existsSync(worker.path));
		assert.equal(state().landed.root, undefined);
		assert.equal(state().chains.root.phase, decompose ? "refine" : "integrate");
		const intent = decompose ? state().refinements[worker.handle].acceptance! : state().landingOps.root;
		assert.equal(intent.preparedHead, head);
		assert.equal(intent.landedHead, undefined);
		console.log(`${mode}: SIGKILL after Git reached ${head}; only the prepared receipt survived`);

		launch();
		if (decompose) {
			await wait(() => !!state().chains.part?.handle && retired(), "child launch and refiner retirement");
			const final = state(), accepted = final.refinements[worker.handle];
			assert.equal(accepted.phase, "accepted");
			assert.equal(accepted.acceptance?.report, report);
			assert.equal(accepted.acceptance?.landedHead, head);
			assert.equal(f.tracker.fields("part")["claimed-by"], "reconcile:root");
			assert.equal(f.git(target, "rev-parse", "HEAD"), head);
			assert.equal(f.git(final.chains.part.handle!.path, "rev-parse", "HEAD"), head);
			assert.equal(f.git(f.cwd, "diff", "--name-only", before, "HEAD", "--", ".", ":(exclude)docs/issues"), "");
			assert.equal(f.bb.threads().filter(t => t.title.startsWith("root/part-implement-")).length, 1);
			assert.deepEqual(Object.keys(final.chains), ["part"]);
			console.log("decompose: original turn accepted; stubs in collector only; one child started from the landed head; refiner retired");
		} else {
			await killed("tracker-close kill");
			assert.equal(readFileSync(closed, "utf8"), String(child!.pid));
			assert.equal(f.tracker.fields("root").stage, "done");
			assert.equal(state().landed.root.head, head);
			assert.equal(state().chains.root.phase, "integrate");
			assert.ok(existsSync(worker.path));
			console.log("plain: SIGKILL after tracker closed the issue; integrating chain and worker still present");
			launch();
			await wait(() => state().finished === "done", "completed run");
			assert.equal(await child!.exited, 0);
			const final = state();
			assert.deepEqual(final.chains, {});
			assert.equal(final.landed.root.head, head);
			assert.ok(final.landingOps.root.cleanupDone);
			assert.equal(final.results.root.summary, "Review turn preserved");
			assert.ok(final.results.root.closedAt);
			assert.ok(retired());
			assert.ok(f.bb.threads().find(t => t.id === owner)?.tells.some(note => note.includes("done: root landed")));
			console.log("plain: original review result closed; chain cleared; reviewer retired; owner received done");
		}
		assert.deepEqual(state().exceptions, {});
		assert.deepEqual(readFileSync(merges, "utf8").trim().split("\n"), [head]);
		console.log(`${mode}: exactly one post-merge hook invocation`);
	} catch (error) {
		console.error(state()?.log.join("\n"));
		throw error;
	} finally {
		if (child && child.exitCode === null && !child.signalCode) child.kill();
		await child?.exited;
		f.close();
	}
}
