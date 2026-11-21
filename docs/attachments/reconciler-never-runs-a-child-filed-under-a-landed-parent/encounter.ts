// Offline CLI encounter: real Git, tracker and reconciler; simulated BB worker turns.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { start, stop } from "../../../lib/reconcile/main";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { load, saveState } from "../../../lib/reconcile/reconcile";

const f = protocolFixture();
const owner = "thr_owner";
const state = () => load(f.cwd, "root");
const turn = (handoff: object) => "done\n\n```json\n" + JSON.stringify(handoff) + "\n```";
async function observe<T>(read: () => T | undefined) {
	for (let i = 0; i < 400; i++) {
		const value = read();
		if (value) return value;
		if (state()?.finished) break;
		await Bun.sleep(100);
	}
	throw new Error(state()?.log.join("\n") || "Reconciler did not publish state");
}
const worker = (slug: string, phase: string) => observe(() => {
	const chain = state()?.chains[slug];
	return chain?.phase === phase && chain.handle && f.bb.threads().some(t => t.environment === chain.handle!.path)
		? chain.handle : undefined;
});
try {
	process.env.PI_RECONCILE_TICK_MS = "100";
	mkdirSync(join(f.root, "agents/roles"), { recursive: true });
	for (const role of ["implement", "review"]) {
		writeFileSync(join(f.root, "agents", role + "r.md"), "---\nrole: " + role + "\n---\nOffline worker.\n");
		writeFileSync(join(f.root, "agents/roles", role + ".md"), "Offline worker.\n");
	}
	f.bb.addThread(owner);
	f.create("parent", { "part-of": "root" });
	const head = f.commit(f.collector, "parent.txt", "parent already delivered\n");
	const receipt = { into: "root", head, at: new Date().toISOString() };
	saveState({ ...f.state, backend: "threads", owner, budget: 1, landed: { parent: receipt },
		collectors: { root: { path: f.collector, branch: "collector", parentBranch: "main" } },
		chains: {}, exceptions: {}, tests: {}, resolved: {}, moved: {}, counter: 0, log: [] });
	f.create("late", { "part-of": "parent", assignee: "agent:implementr", drive: "none" });
	f.create("sibling", { "part-of": "root", "blocked-by": ["late"], assignee: "agent:implementr" });
	console.log("Seeded:", f.cwd, { lateParent: f.tracker.snapshot().get("late")?.partOf, receipt });
	start({ cwd: f.cwd, root: "root", owner, budget: 1 });
	const implementer = await worker("late", "implement");
	const notice = await observe(() => f.bb.threads().find(t => t.id === owner)?.tells.find(t => t.includes("reparented late")));
	console.log("After scheduling:", { worker: implementer.handle, base: f.git(implementer.path, "rev-parse", "HEAD"),
		lateParent: f.tracker.snapshot().get("late")?.partOf, siblingPhase: state()?.chains.sibling?.phase ?? null, notice });
	f.commit(implementer.path, "late.txt", "late work\n");
	f.bb.completeTurn(implementer.path, turn({}));
	const reviewer = await worker("late", "review");
	const evidence = "docs/attachments/late.md";
	f.commit(reviewer.path, evidence, "# Simulated review\n\nLate work is present.\n");
	f.bb.completeTurn(reviewer.path, turn({ stories: [{ story: "Late work is present", outcome: "held" }],
		evidence: { path: evidence, visual: false, shots: [] } }));
	const sibling = await worker("sibling", "implement");
	console.log("After simulated review:", { worker: sibling.handle, base: f.git(sibling.path, "rev-parse", "HEAD"),
		parentReceipt: state()?.landed.parent, lateReceipt: state()?.landed.late });
} finally {
	try { if (state()) await stop(f.cwd, "root"); } finally { f.close(); }
}
