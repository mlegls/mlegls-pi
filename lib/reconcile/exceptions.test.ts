import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "./protocol-fixture";
import { getThread } from "../thread/registry";
import { readFrom, send } from "../board/store";

// In-process reconciler on a local tracker, with no launches: budget 0 keeps it from starting handlers or workers, so
// only what the owner and the worker did can resolve the exception.
async function reconcile(prepare: (f: ReturnType<typeof protocolFixture>, r: typeof import("./reconcile")) => Promise<void>, done: (r: typeof import("./reconcile"), cwd: string) => boolean) {
	const f = protocolFixture(), from = process.cwd();
	process.env.PI_RECONCILE_TICK_MS = "100";
	const r = await import("./reconcile");
	const controller = new AbortController();
	try {
		f.create("fixture", { "part-of": "root" });
		await prepare(f, r);
		const timer = setInterval(() => { if (done(r, f.cwd)) controller.abort(); }, 50);
		const deadline = setTimeout(() => controller.abort(), 20_000);
		// run() moves into the checkout, which close() removes.
		try { await r.run({ cwd: f.cwd, root: "root", owner: "mail/fixture-owner", budget: 0, signal: controller.signal }); }
		finally { process.chdir(from); }
		clearInterval(timer); clearTimeout(deadline);
		return { f, state: r.load(f.cwd, "root")! };
	} catch (e) { f.close(); throw e; }
}
const reportTs = new Date(Date.now() - 60_000).toISOString();
const held = (r: typeof import("./reconcile"), f: ReturnType<typeof protocolFixture>, handler?: { run: string; handle: string; path: string; threadId: string }): import("./reconcile").State => ({
	backend: "threads", root: "root", cwd: f.cwd, owner: "mail/fixture-owner", budget: 0,
	landed: {}, results: {}, landingOps: {}, refinements: {},
	collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } },
	chains: { fixture: { into: "root", self: false, phase: "implement", retries: {}, workers: [], held: true, handledTs: reportTs,
		launchedAt: Date.now() - 120_000, handle: { run: "root", handle: "fixture-implement-1", path: join(f.root, "gone") } } },
	exceptions: { fixture: { id: "fixture-1", node: "fixture", reason: "implement blocked", text: "blocked\n\nWhich fixture?", at: reportTs,
		level: "root", reportTs, ...(handler ? { handler, handlerLaunchedAt: Date.now() } : {}) } },
	tests: {}, resolved: {}, moved: {}, counter: 0, log: [],
});

test("an owner resolution queued while the exception is below the owner applies there, without a handler", async () => {
	const { f, state } = await reconcile(async (f, r) => {
		r.saveState(held(r, f));
		mkdirSync(r.resolutionsDir(f.cwd, "root"), { recursive: true });
		writeFileSync(join(r.resolutionsDir(f.cwd, "root"), "fixture.json"), JSON.stringify({ action: "skip-drive", note: "the owner drove it" }));
	}, (r, cwd) => !r.load(cwd, "root")?.exceptions.fixture);
	try {
		expect(state.exceptions).toEqual({});
		expect(state.chains.fixture).toMatchObject({ held: false, skipDrive: "the owner drove it", phase: "implement" });
		expect(state.log.some(l => l.includes("owner resolution for fixture applies at root"))).toBe(true);
		expect(state.log.some(l => l.includes("handler"))).toBe(false);
	} finally { f.close(); }
}, 30_000);

test("a checkpoint since the exception does not withdraw it", async () => {
	const until = Date.now() + 1500;
	const { f, state } = await reconcile(async (f, r) => {
		r.saveState(held(r, f));
		send({ topic: "root/fixture-implement-1", tags: ["checkpoint"], from: {}, body: "checkpoint" });
	}, () => Date.now() > until);
	try {
		expect(state.exceptions.fixture).toMatchObject({ reason: "implement blocked" });
		expect(state.chains.fixture.held).toBe(true);
	} finally { f.close(); }
}, 30_000);

test("a worker the owner told to continue withdraws its exception and retires the handler deliberating on it", async () => {
	let handlerId = "";
	const { f, state } = await reconcile(async (f, r) => {
		const handler = await f.worker("root-handler-2");
		handlerId = handler.threadId;
		r.saveState(held(r, f, handler));
		send({ topic: "root/fixture-implement-1", tags: ["waiting"], from: {}, body: "waiting\n\nContinuing as the owner said; the import runs." });
	}, (r, cwd) => !r.load(cwd, "root")?.exceptions.fixture);
	try {
		expect(state.exceptions).toEqual({});
		expect(state.chains.fixture).toMatchObject({ held: false });
		expect(state.chains.fixture.waitingSince).toBeDefined();
		expect((await getThread(handlerId))?.archived).toBe(true);
		const owner = readFrom(0).messages.filter(m => m.topic === "mail/fixture-owner" || m.body.includes("[reconcile root]")).map(m => m.body);
		expect(owner.some(b => b.includes("withdrew the exception for fixture") && b.includes("reported again (waiting)"))).toBe(true);
	} finally { f.close(); }
}, 30_000);
