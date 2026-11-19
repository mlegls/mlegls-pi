// Drive the reconciler's phase start against Concept's historical commit objects.
// The tracker, branches, ledger, BB threads and written Git objects are all scratch state.
import { chmodSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { git, isAncestor } from "../../../lib/reconcile/checks";
import { resolveException, start, stop } from "../../../lib/reconcile/main";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { load, resolutionsDir, saveState, type State } from "../../../lib/reconcile/reconcile";
import { until } from "../../../lib/reconcile/setup-fixture";

const cases = [
	{ name: "strand-tags", base: "9b20c1938", source: "2108745e1", required: "8bfc65b8b", blocker: "let-patches-add-members-to-base-tags" },
	{ name: "startup-refinement", base: "f042591bf", source: "e7d54e22e", respec: true },
	{ name: "5000-card-startup", base: "87bb5753b", source: "0afc596da", handMerge: "3ede6f0a7" },
	{ name: "card-to-problem", base: "022f159e4", source: "00dca0acb", required: "76d691f98", blocker: "generate-and-grade-problems-by-program" },
];
const [repository, selector, resolution] = process.argv.slice(2);
if (!repository || selector && !cases.some(row => row.name === selector) || resolution && !["answer", "retry"].includes(resolution)) {
	throw new Error("Usage: bun replay.ts CONCEPT_CHECKOUT [strand-tags|startup-refinement|5000-card-startup|card-to-problem [answer|retry]]");
}
const objectDir = git(resolve(repository), "rev-parse", "--path-format=absolute", "--git-path", "objects");
const owner = "thr_owner";
for (const row of cases.filter(row => !selector || row.name === selector)) {
	const f = protocolFixture();
	const state = () => load(f.cwd, "root")!;
	const wait = async <T>(read: () => T | undefined | false) => until(() => {
		const current = state();
		if (current.finished && current.finished !== "stuck") throw new Error(current.finished);
		return read();
	});
	try {
		process.env.PI_RECONCILE_TICK_MS = "100";
		// Launch reaches the worker checkout. Historical product install/build tasks are outside the replay.
		const mise = join(f.bb.dir, "mise");
		writeFileSync(mise, "#!/bin/sh\n[ \"$1 $2 $3\" = 'tasks ls --json' ] || exit 1\nprintf '[]\\n'\n");
		chmodSync(mise, 0o755);
		process.env.PATH = f.bb.dir + ":" + process.env.PATH;
		mkdirSync(join(f.root, "agents/roles"), { recursive: true });
		for (const role of ["implement", "refine"]) {
			writeFileSync(join(f.root, "agents/roles", role + ".md"), "Replay worker.\n");
			writeFileSync(join(f.root, "agents", role + "r.md"), "---\nrole: " + role + "\n---\nReplay worker.\n");
		}
		writeFileSync(join(f.cwd, ".git/objects/info/alternates"), objectDir + "\n");
		const base = f.git(f.cwd, "rev-parse", row.base), tip = f.git(f.cwd, "rev-parse", row.source);
		const required = row.required ? f.git(f.cwd, "rev-parse", row.required) : tip;
		f.git(f.collector, "reset", "--hard", base);
		f.bb.addThread(owner);
		if (row.blocker) f.create(row.blocker, { assignee: "human" });
		f.create(row.name, { "part-of": "root", assignee: "agent:implementr", ...(row.blocker ? { "blocked-by": [row.blocker] } : {}) });
		const s: State = { ...f.state, backend: "threads", owner, budget: 1, chains: {}, exceptions: {},
			collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } }, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] };
		if (!row.respec && !row.blocker) {
			// Start at the boundary after the supervisor named the kept collector checkpoint.
			f.git(f.cwd, "branch", "retained-collector", tip);
			s.launchCheckpoints = { [row.name]: { [tip]: "refs/heads/retained-collector" } };
		}
		saveState(s);
		const begin = () => start({ cwd: f.cwd, root: "root", owner, budget: 1, quiet: true });
		begin();
		if (row.blocker) {
			await wait(() => state().finished === "stuck");
			const source = join(f.root, "source");
			f.git(f.cwd, "worktree", "add", "--no-checkout", "-qb", "source", source, tip);
			saveState({ ...s, root: row.blocker, finished: "done", landed: { [row.blocker]: { head: required, into: source, at: new Date().toISOString() } } });
			f.tracker.update(row.blocker, { stage: "done" });
			f.tracker.update(row.name, { "blocked-by": null });
			await stop(f.cwd, "root");
			begin();
		}
		const chain = () => state().chains[row.name];
		const exception = () => state().exceptions[row.name];
		const spawnedWorkers = () => f.bb.calls().filter(call => call[0] === "thread" && call[1] === "spawn")
			.map(call => call[call.indexOf("--title") + 1]);
		if (row.respec) {
			const initial = await wait(() => chain()?.handle ?? exception());
			if (!("path" in initial)) throw new Error(initial.text);
			f.git(initial.path, "reset", "--hard", tip);
			f.bb.completeTurn(initial.path, "blocked\n\n```json\n" + JSON.stringify({ commit: tip, respec: "Refine from the retained Profile startup repair." }) + "\n```");
		}
		const observed = () => {
			const ex = exception(), c = chain();
			if (ex) return { phase: c.phase, spawnedWorkers: spawnedWorkers(), level: ex.level, reason: ex.reason, ...ex.baseConflict };
			if (!c?.handle || c.launching || row.respec && c.phase !== "refine") return;
			const head = f.git(c.handle.path, "rev-parse", "HEAD");
			return { phase: c.phase, spawnedWorkers: spawnedWorkers(), head, containsRequirement: isAncestor(f.cwd, required, head) };
		};
		const first = await wait(observed);
		console.log(JSON.stringify({ case: row.name, ...first }, null, 2));
		if (resolution && exception()?.baseConflict) {
			await wait(() => exception()?.mailed);
			if (row.name === "card-to-problem" && resolution === "answer") {
				resolveException(f.cwd, "root", row.name, { action: "answer", target: "root" });
				await wait(() => !existsSync(join(resolutionsDir(f.cwd, "root"), row.name + ".json")));
				console.log(JSON.stringify({ case: row.name, wrongTargetHeld: !!exception()?.baseConflict, spawnedWorkers: spawnedWorkers() }));
			}
			if (resolution === "retry" && !row.handMerge) throw new Error("No historical hand merge for this case; use answer.");
			resolveException(f.cwd, "root", row.name, { action: resolution, ...(resolution === "retry" ? { commit: row.handMerge } : {}) });
			const released = await wait(() => !exception() && observed());
			console.log(JSON.stringify({ case: row.name, resolution, ...released, ownerExceptions: state().log.filter(line => line.includes("exception " + row.name + ":")).length }, null, 2));
		}
	} catch (error) {
		console.error(state()?.log.join("\n"));
		throw error;
	} finally {
		try { if (state()) await stop(f.cwd, "root"); } finally { f.close(); }
	}
}
