// Disposable actual-run drive machinery, not a retained test. No inference or shared state.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Handle } from "../../../lib/dispatch.ts";
import type { State } from "../../../lib/reconcile/reconcile.ts";

const packagePath = realpathSync(join(import.meta.dir, "../../.."));
const modes = ["failed", "replaced", "adopted", "accept-replay"] as const;
type Mode = typeof modes[number];
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function until<T>(read: () => T | false | undefined | Promise<T | false | undefined>): Promise<T> {
	for (let n = 0; n < 600; n++) { const value = await read(); if (value) return value; await Bun.sleep(100); }
	throw new Error("Refinement fixture readiness timeout");
}
export async function refinement(mode: Mode) {
	const root = realpathSync(mkdtempSync("/tmp/rc-global-refinement-")), saved = { ...process.env };
	const cwd = join(root, "repo"), bin = join(root, "bin"), agents = join(root, "agents");
	const cli = join(packagePath, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
	const cutFile = join(root, "cut.json"), cutReceipt = join(root, "cut-receipt.json");
	let cleanup: (() => Promise<void>) | undefined;
	try {
		for (const key of Object.keys(process.env)) if (/^(?:PI_WM_.*|PI_BOARD_.*|PI_SESSION_.*|AB_THREAD_ID|BB_.*|PI_THREAD_RUNTIME|ZMX_.*|TMUX.*|WORKER_.*|TRACKER_.*)$/.test(key)) delete process.env[key];
		Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
			PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
			PI_AGENTS_DIR: agents, TRACKER_CLI: join(root, "tracker.ts"), PI_THREAD_RUNTIME: "zmx",
			MISE_TRUSTED_CONFIG_PATHS: root, PARALLEL_HOME: join(root, "parallel"), WORKER_SLOTS: "3",
			WORKER_PRESSURE_PROBE: "printf '%s' '{\"freePercent\":80,\"swapMB\":0}'", PATH: bin + ":" + saved.PATH });
		for (const dir of [cwd, bin, join(agents, "roles")]) mkdirSync(dir, { recursive: true });
		// A tracker write is real; the wrapper cuts only after the selected publication,
		// before returning to its exact reconciler parent (thus before the following save).
		writeFileSync(join(root, "tracker.ts"), [
			'import { execFileSync } from "node:child_process";',
			'import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";',
			"const args = process.argv.slice(2);",
			"const output = execFileSync('bun', [" + JSON.stringify(cli) + ", ...args], {cwd: process.cwd(), input: await Bun.stdin.text(), encoding:'utf8', env:process.env});",
			"const cutFile = " + JSON.stringify(cutFile) + ";",
			"if (existsSync(cutFile)) {",
			" const cut = JSON.parse(readFileSync(cutFile, 'utf8'));",
			" if (args[0] === cut.verb && args[1] === cut.slug) {",
			"  const state = JSON.parse(readFileSync(cut.stateFile, 'utf8'));",
			"  if (state.pid !== process.ppid) throw new Error('Cut caller is not exact reconciler');",
			"  const cmd = execFileSync('ps', ['-p', String(state.pid), '-o', 'command='], {encoding:'utf8'});",
			"  if (!cmd.includes('lib/reconcile/main.ts run root')) throw new Error('Not fixture run');",
			"  writeFileSync(" + JSON.stringify(cutReceipt) + ", JSON.stringify({state, args, pid:state.pid}));",
			"  rmSync(cutFile); process.kill(state.pid, 'SIGKILL');",
			" }",
			"}",
			"process.stdout.write(output);",
		].join("\n"));
		writeFileSync(join(bin, "pi"), "#!/bin/sh\nprintf '%s' \"$$\" > shell-pid\ntouch shell-started\nexec sleep 600\n", { mode: 0o755 });
		for (const [name, role] of [["shell", "implement"], ["shell-refine", "refine"], ["shell-drive", "drive"], ["shell-handler", "handle"], ["tidy", "review"]]) {
			writeFileSync(join(agents, name + ".md"), "---\nrole: " + role + "\n---\nDeterministic shell stance.\n");
			writeFileSync(join(agents, "roles", role + ".md"), "Deterministic shell role.\n");
		}
		// Imports that cache agent/runtime paths happen only after isolation.
		const { start, stop, resolveException } = await import("../../../lib/reconcile/main.ts");
		const { load, saveState, stateFile, resolutionsDir } = await import("../../../lib/reconcile/reconcile.ts");
		const { allThreads, getThread } = await import("../../../lib/thread/registry.ts");
		const { abandonThread } = await import("../../../lib/thread/lifecycle.ts");
		const { getTracker } = await import("../../../lib/tracker.ts");
		const { send } = await import("../../../lib/board/store.ts");
		cleanup = async () => {
			if (load(cwd, "root")) await stop(cwd, "root");
			for (const t of await allThreads()) if (t.project === cwd && !t.archived) await abandonThread(t.id);
		};
		const commit = (path: string, file: string, content: string) => {
			writeFileSync(join(path, file), content); git(path, "add", "--", file); git(path, "commit", "-qm", file);
		};
		git(cwd, "init", "-qb", "main"); git(cwd, "config", "user.name", "Fixture"); git(cwd, "config", "user.email", "fixture@example.invalid");
		mkdirSync(join(cwd, "docs/issues"), { recursive: true });
		commit(cwd, ".gitignore", "shell-started\nshell-pid\nsetup-ready\n");
		commit(cwd, "mise.toml", '[tasks.setup]\nrun = "touch setup-ready"\n');
		mkdirSync(join(cwd, "docs/attachments"), { recursive: true });
		commit(cwd, "docs/attachments/packet.md", "# Offline shell evidence\n\nx is held by the deterministic fixture.\n");
		const tracker = getTracker(cwd, { inflight: false });
		const create = (slug: string, fields: Record<string, unknown>) => tracker.create({ slug,
			fields: { author: "session:fixture", assignee: "agent:shell", ...fields }, body: "Offline " + slug + " contract.\n" });
		create("root", { stage: "spec", assignee: "agent" });
		create("baseline", { stage: "done", "part-of": "root" });
		create("friction", { stage: "idea", assignee: "human" });
		create("outside", { stage: "ticket", "blocked-by": ["baseline"] });
		// Tracker.create commits in the isolated global vault, not the code repository.
		const state = () => load(cwd, "root")!;
		const boot = () => start({ cwd, root: "root", owner: "mail/refinement-owner", budget: 1 });
		const ready = async (node = "root", different?: string) => until(() => {
			const h = state()?.chains[node]?.handle;
			return h && h.handle !== different && existsSync(join(h.path, "shell-started")) && existsSync(join(h.path, "setup-ready")) && h;
		});
		const shellPid = (h: Handle) => Number(readFileSync(join(h.path, "shell-pid"), "utf8"));
		const report = (h: Handle, status: string, handoff: object) => send({ from: {}, topic: h.run + "/" + h.handle,
			tags: [status], body: status + "\n\n" + "\x60\x60\x60json\n" + JSON.stringify(handoff) + "\n\x60\x60\x60" });
		const attempt = (h: Handle) => state().refinements[h.handle];
		const claim = async (h: Handle) => {
			const prompt = (await getThread(h.threadId!))!.launch!.prompt!;
			const token = /exact claimed-by token, atomically with part-of: (\S+)/.exec(prompt)?.[1];
			assert.equal(token, attempt(h).claim); return token!;
		};
		const children = (token: string) => {
			create("x", { stage: "ticket", "part-of": "root", "claimed-by": token, drive: "none" });
			create("y", { stage: "ticket", "part-of": "root", "claimed-by": token, "blocked-by": ["x"], drive: "none" });
		};
		const noDispatch = async () => {
			assert(!state().chains.x && !state().chains.y);
			assert(!(await allThreads(true)).some(t => t.project === cwd && /^([xy])-implement-/.test(t.worker?.handle ?? "")));
		};
		const observed = (h: Handle) => until(() => attempt(h).owned.includes("x") && attempt(h).owned.includes("y"));
		const protect = () => {
			const rows = tracker.snapshot(); assert(rows.has("baseline") && rows.get("baseline")!.done);
			assert(rows.has("friction") && rows.has("outside"));
		};
		const cut = (verb: string, slug: string) => {
			rmSync(cutReceipt, { force: true });
			writeFileSync(cutFile, JSON.stringify({ verb, slug, stateFile: stateFile(cwd, "root") }));
		};
		const cutState = async () => {
			await until(() => existsSync(cutReceipt));
			const receipt = JSON.parse(readFileSync(cutReceipt, "utf8")) as { state: State; args: string[]; pid: number };
			await until(() => !alive(receipt.pid));
			return receipt.state;
		};
		const crash = async () => {
			const s = state(), pid = s.pid!;
			const command = execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
			assert(command.includes("lib/reconcile/main.ts run root"));
			process.kill(pid, "SIGKILL"); await until(() => !alive(pid));
			return s;
		};
		boot();
		const first = await ready(), firstPid = shellPid(first), token = await claim(first);
		assert(alive(firstPid)); assert.deepEqual(attempt(first).baseline.sort(), ["baseline", "root"]);
		console.log(JSON.stringify({ mode, setup: { kind: "private-local-repo", cwd, ready: true, runtime: "zmx", inference: false },
			baseline: attempt(first).baseline, attempt: first.handle, token, writerPid: firstPid }));

		if (mode === "failed") {
			children(token); create("changed", { stage: "ticket", "part-of": "root", "claimed-by": token });
			await observed(first); await noDispatch();
			tracker.update("changed", { "claimed-by": "someone-else", "part-of": null });
			// Preserve the baseline identity, but leave the parent with only provisional
			// children so pruning its last one must restore its saved residual stage.
			tracker.update("baseline", { "part-of": null }); tracker.update("root", { stage: null });
			report(first, "blocked", { question: "Deterministic failed decomposition." });
			await until(() => attempt(first).phase === "removed");
			assert(!alive(firstPid)); assert(!tracker.snapshot().has("x") && !tracker.snapshot().has("y"));
			assert.equal(tracker.fields("root").stage, "spec"); assert.equal(tracker.fields("changed")["claimed-by"], "someone-else");
			protect(); await noDispatch();
			console.log(JSON.stringify({ mode, before: ["x", "y", "changed"], after: [...tracker.snapshot().keys()],
				residualStage: tracker.fields("root").stage, stoppedBeforeCleanup: true, dependentLaunches: 0 }));
		} else if (mode === "replaced") {
			children(token); await observed(first); await noDispatch();
			// Deterministic saved-state cut: stop only the reconciler, not its owned
			// live writer. Publish another create after its last ownership observation.
			const savedCut = await crash(); assert(alive(firstPid));
			create("crash-adjacent", { stage: "ticket", "part-of": "root", "claimed-by": token });
			assert(!savedCut.refinements[first.handle].owned.includes("crash-adjacent"));
			mkdirSync(resolutionsDir(cwd, "root"), { recursive: true });
			writeFileSync(join(resolutionsDir(cwd, "root"), "root.json"), JSON.stringify({ action: "retry" }));
			cut("remove", "y"); boot();
			const removal = await cutState();
			assert(!alive(firstPid)); assert.equal(removal.refinements[first.handle].phase, "cleaning");
			assert(!tracker.snapshot().has("y")); assert(removal.refinements[first.handle].owned.includes("crash-adjacent"));
			boot(); const next = await ready("root", first.handle), nextToken = await claim(next);
			assert.notEqual(nextToken, token); assert.equal(attempt(first).phase, "removed");
			assert(!tracker.snapshot().has("x") && !tracker.snapshot().has("y") && !tracker.snapshot().has("crash-adjacent"));
			assert.deepEqual(attempt(next).baseline.sort(), ["baseline", "root"]); protect(); await noDispatch();
			children(nextToken); await observed(next);
			create("changed", { stage: "ticket", "part-of": "root", "claimed-by": "someone-else" });
			const nextPid = shellPid(next); await stop(cwd, "root");
			assert(!alive(nextPid)); assert(!tracker.snapshot().has("x") && !tracker.snapshot().has("y"));
			assert(tracker.snapshot().has("changed")); protect(); await noDispatch();
			console.log(JSON.stringify({ mode, crashAdjacentAbsentFromSavedOwned: true, discovered: removal.refinements[first.handle].owned,
				partialRemovalPublished: "y", oldWriterStopped: true, successor: next.handle, successorToken: nextToken,
				newBaseline: attempt(next).baseline, explicitStopProtected: ["baseline", "friction", "outside", "changed"] }));
		} else {
			children(token); await observed(first); await noDispatch();
			let accepted = first;
			{
				// Both success modes restore a partial adoption cut before acceptance.
				// Cut immediately after the first transferred claim publishes. The saved
				// successor relation must precede release, and survive partial transfer.
				cut("update", "x"); resolveException(cwd, "root", "root", { action: "retry", adopt: true });
				const adoption = await cutState(), old = adoption.refinements[first.handle], successor = adoption.refinements[old.successor!];
				assert.equal(old.phase, "adopting"); assert.equal(successor.adoptedFrom, first.handle);
				assert.equal(tracker.fields("x")["claimed-by"], successor.claim);
				assert.equal(tracker.fields("y")["claimed-by"], token);
				assert(!alive(firstPid)); await noDispatch();
				boot(); accepted = await ready("root", first.handle);
				assert.equal(accepted.handle, successor.handle);
				for (const slug of ["x", "y"]) assert.equal(tracker.fields(slug)["claimed-by"], successor.claim);
				await noDispatch();
				console.log(JSON.stringify({ mode, adoptionRelation: { old: first.handle, successor: successor.handle, token: successor.claim },
					savedBeforeRelease: true, partialTransfer: { x: successor.claim, y: token }, sameIdentities: ["x", "y"] }));
			}
			commit(accepted.path, "stub.txt", "refinement stub from " + accepted.handle + "\n");
			const originalStub = git(accepted.path, "rev-parse", "HEAD");
			// Parent has no residual stage after decomposition.
			tracker.update("root", { stage: null });
			if (mode === "accept-replay") cut("update", "x");
			const message = report(accepted, "done", { children: ["x", "y"] });
			if (mode === "accept-replay") {
				const acceptance = await cutState(), a = acceptance.refinements[accepted.handle];
				assert.equal(a.phase, "accepting"); assert(a.acceptance?.preparedHead && a.acceptance.landedHead);
				assert.equal(tracker.fields("x")["claimed-by"], "reconcile:root");
				assert.equal(tracker.fields("y")["claimed-by"], await claim(accepted));
				const collectorBefore = git(a.acceptance.destination, "rev-parse", "HEAD");
				// Explicit accepting cut includes already-consumed board report cursor.
				acceptance.chains.root.handledTs = message.ts; saveState(acceptance);
				await noDispatch(); boot();
				await until(() => attempt(accepted).phase === "accepted");
				assert.equal(git(a.acceptance.destination, "rev-parse", "HEAD"), collectorBefore);
				console.log(JSON.stringify({ mode, acceptingCut: { preparedHead: a.acceptance.preparedHead, landedHead: a.acceptance.landedHead,
					consumedReport: message.ts, converted: "x", remaining: "y" }, collectorBefore, collectorAfterReplay: collectorBefore, secondMerge: false }));
			}
			await until(() => attempt(accepted).phase === "accepted");
			for (const slug of ["x", "y"]) assert.equal(tracker.fields(slug)["claimed-by"], "reconcile:root");
			const stub = attempt(accepted).acceptance!.preparedHead!;
			const x = await ready("x"); assert(!state().chains.y);
			assert.equal(readFileSync(join(x.path, "stub.txt"), "utf8"), "refinement stub from " + accepted.handle + "\n");
			git(x.path, "merge-base", "--is-ancestor", stub, "HEAD");
			const launchX = git(x.path, "rev-parse", "HEAD");
			// Let actual review/integrate satisfy y's dependency in the collector.
			commit(x.path, "x.txt", "x code\n"); report(x, "done", { setup: { kind: "shell" } });
			const xr = await until(() => state().chains.x?.phase === "review" && state().chains.x.handle);
			await until(() => existsSync(join(xr.path, "shell-started")));
			report(xr, "done", { stories: [{ story: "x", outcome: "held" }], evidence: { visual: false, path: "docs/attachments/packet.md", shots: [] }, tests: [] });
			const y = await ready("y"); git(y.path, "merge-base", "--is-ancestor", stub, "HEAD");
			assert(existsSync(join(y.path, "x.txt")));
			const launches = (await allThreads(true)).filter(t => t.project === cwd && /^[xy]-implement-/.test(t.worker?.handle ?? ""));
			assert.equal(launches.filter(t => t.worker!.handle.startsWith("x-")).length, 1);
			assert.equal(launches.filter(t => t.worker!.handle.startsWith("y-")).length, 1);
			const countBefore = launches.length;
			await crash(); boot(); await until(() => state().pid && alive(state().pid!));
			await Bun.sleep(5500);
			assert.equal((await allThreads(true)).filter(t => t.project === cwd && /^[xy]-implement-/.test(t.worker?.handle ?? "")).length, countBefore);
			protect();
			console.log(JSON.stringify({ mode, children: ["x", "y"], stableClaims: "reconcile:root", originalStub, preparedStub: stub,
				x: { handle: x.handle, base: launchX }, y: { handle: y.handle, base: git(y.path, "rev-parse", "HEAD"), xCodePresent: true },
				launchCounts: { x: 1, y: 1 }, restartResurrection: false }));
		}
		return { mode, held: true };
	} catch (error) {
		const log = join(cwd, ".git/reconcile/root.log");
		const { readFrom } = await import("../../../lib/board/store.ts");
		console.error(JSON.stringify({ mode, root, log: existsSync(log) ? readFileSync(log, "utf8") : null, board: readFrom(0).messages }));
		throw error;
	} finally {
		try { await cleanup?.(); }
		finally { process.env = saved; process.chdir(packagePath); rmSync(root, { recursive: true, force: true }); }
	}
}
if (import.meta.main) {
	const mode = process.argv[2];
	if (mode) {
		if (!modes.includes(mode as Mode)) throw new Error("Use failed|replaced|adopted|accept-replay");
		console.log("RESULT " + JSON.stringify(await refinement(mode as Mode)));
	} else {
		for (const selected of modes) {
			const child = Bun.spawn(["bun", import.meta.path, selected], { stdout: "inherit", stderr: "inherit" });
			assert.equal(await child.exited, 0, selected + " failed");
		}
	}
}
