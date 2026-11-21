// Offline first use: real reconciler and tracker, fake BB turns, disposable local Git repository.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveException, start, stop } from "../../../lib/reconcile/main";
import { load } from "../../../lib/reconcile/reconcile";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";

const f = protocolFixture();
const { bb, cwd, tracker } = f;
const owner = "thr_fixture";
const read = () => load(cwd, "root");
async function until<T>(label: string, read: () => T | undefined | false): Promise<T> {
	for (let n = 0; n < 600; n++) {
		const value = read();
		if (value) return value;
		await Bun.sleep(100);
	}
	throw new Error("Timed out: " + label);
}
const writer = () => read()?.chains.root?.handle;
const thread = (path: string) => bb.threads().find(t => t.environment === path);
const report = (status: string, handoff: object) => status + "\n\n```json\n" + JSON.stringify(handoff) + "\n```";
const claim = (handle: string) => "reconcile:root/" + handle;

try {
	Object.assign(process.env, { PI_RECONCILE_TICK_MS: "100" });
	const agents = join(f.root, "agents");
	mkdirSync(join(agents, "roles"), { recursive: true });
	for (const role of ["refine", "implement"]) {
		writeFileSync(join(agents, role + ".md"), "---\nrole: " + role + "\n---\nFixture.\n");
		writeFileSync(join(agents, "roles", role + ".md"), "Fixture role.\n");
	}
	bb.addThread(owner);
	start({ cwd, root: "root", owner, budget: 1 });
	const first = await until("first refiner", () => { const h = writer(); return h && thread(h.path) && h; });
	console.log({ ready: true, cwd, worker: first.handle });
	const stub = f.commit(first.path, "stub.ts", "export interface Stub {}\n");
	f.create("pruned", { "part-of": "root", "claimed-by": claim(first.handle) });
	bb.completeTurn(first.path, report("needs-input", { commit: stub, question: "Should live setup be outside this run?" }));
	const notice = await until("owner recovery notice", () => bb.threads().find(t => t.id === owner)?.tells.find(t => t.includes("Reposting from the removed writer cannot work")));
	assert.equal(read()?.refinements[first.handle].phase, "removed");
	assert(!tracker.snapshot().has("pruned"));
	console.log(notice);

	// Reproduce a late tracker write from a legacy continuation. No saved run state is edited.
	f.create("retained", { "part-of": "root", "claimed-by": claim(first.handle) });
	bb.completeTurn(first.path, report("done", { children: ["retained"], commit: stub }));
	const late = await until("late report at owner", () => bb.threads().find(t => t.id === owner)?.tells.find(t => t.includes("Late report from " + first.handle)));
	assert(late.includes("retained") && late.includes("Reposting from the removed writer cannot work"));
	assert.equal(read()?.refinements[first.handle].phase, "removed");
	console.log(late);
	tracker.update("retained", { "claimed-by": "reconcile:root" });
	resolveException(cwd, "root", "root", { action: process.argv.includes("--retry") ? "retry" : "answer", message: "Keep live setup outside this run." }, owner);
	const second = await until("fresh writer", () => { const h = writer(); return h && h.handle !== first.handle && thread(h.path) && h; });
	const prompt = thread(second.path)!.prompt;
	console.log(prompt.slice(prompt.indexOf("Refinement baseline:")));
	assert(prompt.includes("Keep live setup outside this run."));
	assert(prompt.includes("Refinement baseline: root, retained."));
	assert(prompt.includes("stable claimed-by: reconcile:root"));
	assert(prompt.includes(claim(second.handle)));
	f.git(second.path, "merge-base", "--is-ancestor", stub, "HEAD");
	console.log({ previous: first.handle, successor: second.handle, baseline: read()?.refinements[second.handle].baseline, stub });

	// The root is also a baseline contract and accepts the same stable reservation.
	tracker.update("root", { "claimed-by": "reconcile:root" });
	f.create("fresh", { "part-of": "root", "claimed-by": claim(second.handle), "blocked-by": ["retained"] });
	bb.completeTurn(second.path, report("done", { children: ["retained", "fresh"] }));
	await until("accepted fresh refinement", () => read()?.refinements[second.handle].phase === "accepted");
	for (const slug of ["root", "retained", "fresh"]) assert.equal(tracker.fields(slug)["claimed-by"], "reconcile:root");
	assert.equal(read()?.refinements[first.handle].phase, "removed");
	const collector = read()?.collectors.root.path;
	assert(collector);
	f.git(collector, "merge-base", "--is-ancestor", stub, "HEAD");
	await until("first child launch", () => read()?.chains.retained?.handle);
	console.log({ accepted: second.handle, children: ["retained", "fresh"], stableClaim: "reconcile:root", stubsLanded: true });
} catch (error) {
	console.error({ state: read(), tells: bb.threads().map(t => ({ title: t.title, tells: t.tells })) });
	throw error;
} finally {
	try { if (read() && !read()?.finished) await stop(cwd, "root"); }
	finally { f.close(); }
}
