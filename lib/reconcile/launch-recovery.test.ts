import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";
import { start, stop } from "./main";
import { load, saveState } from "./reconcile";

async function until<T>(read: () => T | undefined | false): Promise<T> {
	for (let i = 0; i < 400; i++) {
		const value = read();
		if (value) return value;
		await Bun.sleep(100);
	}
	throw new Error("timed out waiting for chain launch receipt");
}

// Ticket-approved recovery property: a saved launch title is adopted or launched once, never replaced by a fresh name.
test("an interrupted chain launch adopts its titled worker or launches once under its saved name", async () => {
	for (const registered of [true, false]) {
		const f = protocolFixture();
		let running = false;
		try {
			Object.assign(process.env, { PI_RECONCILE_TICK_MS: "100" });
			mkdirSync(join(f.root, "agents/roles"), { recursive: true });
			writeFileSync(join(f.root, "agents/shell.md"), "---\nrole: implement\n---\nShell fixture.\n");
			writeFileSync(join(f.root, "agents/roles/implement.md"), "Shell fixture.\n");
			f.tracker.update("root", { stage: "ticket", assignee: "agent:shell" });
			f.bb.addThread("thr_owner");
			const launching = "root-implement-1";
			const worker = registered ? f.worker(launching, f.cwd, "main") : undefined;
			if (worker) f.bb.addThread(worker.bb, worker.path, "root/" + launching);
			saveState({ backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 1,
				landed: {}, results: {}, landingOps: {}, refinements: {}, collectors: {},
				chains: { root: { into: f.cwd, self: false, phase: "implement", launching, retries: {}, workers: [] } },
				exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 1, log: [] });
			start({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 1 });
			running = true;
			const chain = await until(() => {
				const c = load(f.cwd, "root")?.chains.root;
				return c?.handle && !c.launching && c;
			});
			expect(chain.handle!.handle).toBe(launching);
			expect(chain.launchedAt).toBeGreaterThan(0);
			if (worker) expect(chain.handle!.bb).toBe(worker.bb);
			await Bun.sleep(300);
			const spawns = f.bb.calls().filter(call => call[0] === "thread" && call[1] === "spawn");
			expect(spawns).toHaveLength(registered ? 0 : 1);
			expect(load(f.cwd, "root")!.counter).toBe(1);
			expect(f.bb.threads().filter(t => t.title === "root/" + launching && !t.archivedAt)).toHaveLength(1);
		} catch (error) {
			console.error(JSON.stringify(load(f.cwd, "root"), null, 2));
			throw error;
		} finally {
			if (running) await stop(f.cwd, "root");
			f.close();
		}
	}
}, 120_000);
