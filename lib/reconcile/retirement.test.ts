import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";
import { keepIgnored, pruneRetired } from "../thread/lifecycle-cleanup";

// Ticket-approved regression: declared captures survive; routine retained output is quiet and pruned after merge.
// Real Git/retirement and owner messaging on fake bb; no model, daemon, service or paid API.
test("finished retirement reports declared captures, keeps Convex state, and quietly prunes merged routine state", async () => {
	const f = protocolFixture(), from = process.cwd();
	const controller = new AbortController();
	let timer: ReturnType<typeof setInterval> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
	try {
		process.env.PI_RECONCILE_TICK_MS = "100";
		mkdirSync(join(process.env.PI_AGENTS_DIR!, "roles"), { recursive: true });
		writeFileSync(join(process.env.PI_AGENTS_DIR!, "driver.md"), "---\nrole: drive\n---\nFixture driver.\n");
		writeFileSync(join(process.env.PI_AGENTS_DIR!, "roles/drive.md"), "Fixture drive role.\n");
		const r = await import("./reconcile");
		f.tracker.update("root", { stage: "ticket" });
		f.bb.addThread("thr_owner");
		f.commit(f.cwd, ".gitignore", ".captures/\npackages/web/.convex/\nnode_modules/\n.wm/\n");
		const worker = { ...f.worker("root-implement-1", f.cwd, "main"), run: "root" };
		f.bb.addThread(worker.bb, worker.path, worker.run + "/" + worker.handle);
		for (const [path, content] of [
			[".captures/x", "paid export\n"], ["packages/web/.convex/local/state", "local deployment\n"],
			["node_modules/dep/index.js", "regenerable\n"], [".wm/processes/output.log", "routine diagnostics\n"],
		]) {
			mkdirSync(join(worker.path, path, ".."), { recursive: true });
			writeFileSync(join(worker.path, path), content);
		}
		r.saveState({ backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 1,
			landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {},
			chains: { root: { into: f.cwd, self: false, phase: "implement", retries: {}, workers: [], handle: worker,
				base: f.git(f.cwd, "rev-parse", "HEAD"), launchedAt: Date.now() - 1000 } },
			exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 1, log: [] });
		f.bb.completeTurn(worker.path, "done\n\n\x60\x60\x60yaml\nsetup:\n  entry: fixture\n  retained: .captures/x\n\x60\x60\x60");
		timer = setInterval(() => {
			if (r.load(f.cwd, "root")?.chains.root?.phase === "drive") controller.abort();
		}, 50);
		deadline = setTimeout(() => controller.abort(), 20_000);
		try { await r.run({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1, signal: controller.signal }); }
		finally { process.chdir(from); }
		const state = r.load(f.cwd, "root")!;
		expect(state.chains.root.phase).toBe("drive");
		expect(existsSync(worker.path)).toBe(false);
		expect(f.bb.threads().find(t => t.id === worker.bb)?.archivedAt).toBeTruthy();
		const kept = join(f.cwd + "__retired", worker.handle);
		expect(readFileSync(join(kept, ".captures/x"), "utf8")).toBe("paid export\n");
		expect(readFileSync(join(kept, "packages/web/.convex/local/state"), "utf8")).toBe("local deployment\n");
		expect(existsSync(join(kept, "node_modules"))).toBe(false);
		const manifest = readFileSync(join(kept, "RETIRED.md"), "utf8");
		expect(manifest).toContain("branch: " + worker.handle);
		expect(manifest).toContain("- .captures/");
		expect(manifest).toContain("- packages/");
		expect(state.log.some(line => line.includes("retired " + worker.handle + " keeping its ignored state at " + kept))).toBe(true);
		const owner = f.bb.threads().find(t => t.id === "thr_owner")!.tells.join("\n");
		expect(owner).toContain(worker.handle + " after it finished; its worktree held ignored state");
		expect(owner).toContain(kept);
		expect(owner).toContain(".captures/x");
		expect(owner).not.toContain(".wm/");
		expect(owner).not.toContain("node_modules");
		expect(f.bb.threads().find(t => t.id === "thr_owner")!.tells.filter(t => t.includes("its worktree held ignored state"))).toHaveLength(1);
		expect(owner).toContain("packages/");
		expect(owner).toContain("RETIRED.md");

		// The first retained directory names a declared capture; even a merged branch must not prune it.
		expect(await pruneRetired(f.cwd)).not.toContain(kept);
		expect(existsSync(join(kept, ".captures/x"))).toBe(true);
		const routine = f.worker("routine", f.cwd, "main");
		f.git(routine.path, "reset", "--hard", "HEAD");
		const head = f.commit(routine.path, "routine.txt", "worker change\n");
		mkdirSync(join(routine.path, ".wm/processes"), { recursive: true });
		writeFileSync(join(routine.path, ".wm/processes/output.log"), "routine\n");
		const saved = await keepIgnored(routine.path, {
			id: routine.bb, cwd: routine.path, project: f.cwd, worktree: routine.path,
			branch: routine.handle, worker: routine,
		}, undefined);
		expect(saved?.attention).toEqual([]);
		expect(await pruneRetired(f.cwd)).not.toContain(saved!.path);
		f.git(f.cwd, "merge", "--ff-only", head);
		expect(await pruneRetired(f.cwd)).toContain(saved!.path);
		expect(existsSync(saved!.path)).toBe(false);
		expect(existsSync(join(kept, ".captures/x"))).toBe(true);
	} finally {
		clearInterval(timer); clearTimeout(deadline);
		process.chdir(from);
		f.close();
	}
}, 30_000);
