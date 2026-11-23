import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";

for (const signal of ["owner", "body", "handoff"] as const) {
test("a cross-file repair is admitted through " + signal + " without bypassing integration", async () => {
	const f = protocolFixture(), from = process.cwd();
	process.env.PI_RECONCILE_TICK_MS = "100";
	const r = await import("./reconcile");
	const { resolveException } = await import("./main");
	const controller = new AbortController();
	let timer: ReturnType<typeof setInterval> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
	try {
		f.tracker.update("root", { stage: "ready", decompose: null }, signal === "body" ? "Repairs .git/verify-main/log/9cc25e70c\n" : "root contract\n");
		f.commit(f.cwd, "mise.toml", '[tasks.pre-integrate]\nrun = "test -e repair.ts"\n');
		f.bb.addThread("thr_owner");
		const worker = f.worker("root-review-1", f.cwd, "main");
		const head = f.commit(worker.path, "repair.ts", "export const repaired = true;\n");
		const red = "commit 9cc25e70c\n[chromium] › failing.spec.ts:52";
		const dir = join(f.git(f.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "verify-main");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "red"), red);
		r.saveState({ backend: "threads", root: "root", cwd: f.cwd, owner: "thr_owner", budget: 0,
			landed: {}, results: { root: { parent: null, summary: "repair", handoff: signal === "handoff" ? { summary: "repairs 9cc25e70c" } : {} } },
			landingOps: {}, refinements: {}, collectors: {},
			chains: { root: { into: f.cwd, self: false, phase: "integrate", retries: {}, workers: [worker], handle: worker } },
			exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
		let designated = false;
		timer = setInterval(() => {
			const state = r.load(f.cwd, "root")!;
			if (signal === "owner" && !designated && state.chains.root?.redHeld) {
				expect(state.landed.root).toBeUndefined();
				expect(f.git(f.cwd, "rev-parse", "HEAD")).not.toBe(head);
				resolveException(f.cwd, "root", "root", { action: "red-repair" });
				designated = true;
			}
			if (state.landed.root) controller.abort();
		}, 50);
		deadline = setTimeout(() => controller.abort(), 20_000);
		await r.run({ cwd: f.cwd, root: "root", owner: "thr_owner", budget: 0, signal: controller.signal });
		const state = r.load(f.cwd, "root")!;
		expect(designated).toBe(signal === "owner");
		expect(state.landed.root?.head).toBeTruthy();
		expect(state.landingOps.root.preparedHead).toBe(head);
		if (signal === "owner") expect(state.resolved.root).toContain("main is red → red-repair");
		// Admission never clears the project's verdict; verify-main owns it.
		expect(await Bun.file(join(dir, "red")).text()).toBe(red);
	} finally {
		if (timer) clearInterval(timer);
		if (deadline) clearTimeout(deadline);
		controller.abort(); process.chdir(from); f.close();
	}
}, 30_000);
}
