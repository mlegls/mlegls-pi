import { expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handover } from "../handover";
import { byRole } from "../agents";
import * as wm from "../wm";
import * as bb from "../thread/bb";
import { protocolFixture } from "./protocol-fixture";
import { load, run } from "./reconcile";

// Ticket-approved interleaving: slow preparation for ten roots in one repo, with takeover
// both before creation and while a parented thread is still inside the creation lock.
test("concurrent reconciler launches prepare outside ownership, retry live contention and survive takeover", async () => {
	const here = process.cwd(), f = protocolFixture();
	const roots = Array.from({ length: 10 }, (_, n) => "launch-" + n);
	const gate = Promise.withResolvers<void>(), created = Promise.withResolvers<void>();
	const workers: wm.Worker[] = [], running: Promise<unknown>[] = [], abort = new AbortController();
	const signals = ["exit", "SIGTERM", "SIGINT", "SIGHUP"] as const;
	const listeners = signals.map(signal => [signal, new Set(process.listeners(signal))] as const);
	const now = Date.now, spawn = wm.spawn, spawnBb = bb.spawnBb;
	let preparing = 0, creating = 0, firstCreated = "", offset = 0, held = false;
	const notes: string[] = [], log = console.log;
	const logs = spyOn(console, "log").mockImplementation((...args: unknown[]) => { notes.push(args.join(" ")); log(...args); });
	const lock = join(f.cwd, ".git/supervisor.lock");
	const clock = spyOn(Date, "now").mockImplementation(() => now() + offset);
	const slowPrepare = spyOn(wm, "spawn").mockImplementation(async options => {
		const worker = await spawn({ ...options,
			withOwner: options.withOwner ? create => { creating++; return options.withOwner!(create); } : undefined,
			prepare: async path => {
				const prompt = await options.prepare?.(path);
				preparing++;
				await gate.promise;
				return prompt;
			} });
		workers.push(worker);
		return worker;
	});
	const slowCreation = spyOn(bb, "spawnBb").mockImplementation(async (...args) => {
		const id = await spawnBb(...args);
		if (!firstCreated) { firstCreated = id; await created.promise; }
		return id;
	});
	const state = (root: string) => load(f.cwd, root)!;
	const until = async (check: () => boolean, label: string) => {
		for (const end = now() + 45_000; now() < end; await Bun.sleep(50)) if (check()) return;
		throw new Error("timed out: " + label + "\n" + roots.map(root => JSON.stringify(load(f.cwd, root))).join("\n"));
	};
	let takingOver: Promise<unknown> | undefined;
	try {
		const stance = byRole("implement")[0].name;
		for (const owner of ["thr_old", "thr_next", "thr_final"]) f.bb.addThread(owner);
		for (const root of roots) f.create(root, { assignee: "agent:" + stance });
		for (const root of roots) running.push(run({ cwd: f.cwd, root, owner: "thr_old", ownerSession: "session_old",
			budget: 1, quiet: true, signal: abort.signal }));
		await until(() => preparing === roots.length, "all ten prepare callbacks running concurrently");
		expect(existsSync(lock)).toBe(false);
		expect(workers).toHaveLength(0);
		// Preparation neither blocks takeover nor binds the next launch to the archived owner.
		await handover("thr_old", "thr_next", f.cwd);
		expect(roots.every(root => state(root).owner === "thr_next")).toBe(true);

		mkdirSync(lock); writeFileSync(join(lock, "pid"), String(process.pid)); held = true;
		gate.resolve();
		// Once every prepare has returned and setup has run, advance only the lock's elapsed wait.
		await until(() => creating === roots.length, "all prepared launches waiting to create threads");
		offset = 11 * 60_000;
		await until(() => roots.every(root => notes.some(line => line.startsWith("launch " + root + "-implement-1 pending behind a live supervisor lock"))), "live-holder timeouts retried");
		expect(roots.every(root => !state(root).chains[root].handle && !!state(root).chains[root].launching)).toBe(true);
		expect(roots.every(root => Object.keys(state(root).exceptions).length === 0)).toBe(true);
		expect(f.bb.threads().every(thread => thread.tells.length === 0)).toBe(true);
		clock.mockRestore();
		// A dead holder still gets reclaimed by the existing lock acquisition path.
		writeFileSync(join(lock, "pid"), "2147483647"); held = false;
		await until(() => !!firstCreated, "first thread parented inside creation lock");
		expect(f.bb.threads().find(thread => thread.id === firstCreated)?.parentThreadId).toBe("thr_next");
		let transferred = false;
		takingOver = handover("thr_next", "thr_final", f.cwd).then(result => { transferred = true; return result; });
		await Bun.sleep(200);
		expect(transferred).toBe(false);
		expect(f.bb.threads().find(thread => thread.id === "thr_next")?.archivedAt).toBeNull();
		created.resolve();
		await takingOver;
		await until(() => roots.every(root => !!state(root).chains[root].handle), "all ten launch receipts");
		const launched = f.bb.threads().filter(thread => roots.some(root => thread.title.startsWith(root + "/")));
		expect(launched).toHaveLength(roots.length);
		expect(launched.every(thread => !thread.archivedAt && thread.parentThreadId === "thr_final")).toBe(true);
		for (const root of roots) {
			const current = state(root), handle = current.chains[root].handle!;
			expect(current.exceptions).toEqual({});
			expect(current.counter).toBe(1);
			expect(handle.handle).toBe(root + "-implement-1");
			expect(launched.find(t => t.id === handle.bb)?.metadata?.env.PI_WM_PARENT_SESSION).toBeUndefined();
			const receipt = JSON.parse(readFileSync(join(f.cwd, ".git/ab-dispatch", root + "-" + handle.handle + ".json"), "utf8"));
			expect(receipt.parent).toBe("thr_final");
		}
		expect(f.bb.threads().every(thread => thread.tells.length === 0)).toBe(true);
	} finally {
		clock.mockRestore(); gate.resolve(); created.resolve(); abort.abort();
		if (held) rmSync(lock, { recursive: true, force: true });
		await takingOver;
		await Promise.allSettled(running);
		slowPrepare.mockRestore(); slowCreation.mockRestore(); logs.mockRestore();
		for (const worker of workers) await worker.close();
		for (const [signal, prior] of listeners)
			for (const listener of process.listeners(signal)) if (!prior.has(listener)) process.removeListener(signal, listener);
		process.chdir(here);
		f.close();
	}
}, 120_000);
