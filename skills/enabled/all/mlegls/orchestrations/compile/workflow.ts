// compile → fill contract, as a worked example. The unit list is written per
// compilation; what stays fixed is what a `fill` unit receives and how it reports.
// Run from the repo root: `bun workflow.ts`. Workers are interactive pi sessions
// in workmux worktrees (tmux session named after the run); outcomes arrive on the
// board at `<run>/<handle>`.
import { spawn, merge, MergeConflict, type Worker } from "/Users/mlegls/dev/mlegls-pi/lib/wm";

const run = `compile/${Date.now().toString(36)}`;
const units = [
	{ id: "a", stub: "src/x.ts#foo", context: [".wm/scout/1.md"], precedent: ["src/y.ts#bar"], task: "..." },
];

const workers = await Promise.all(
	units.map((u) =>
		spawn({
			run,
			handle: u.id,
			agent: "fill",
			prompt: `stub: ${u.stub}\ncontext: ${u.context.join(" ")}\nprecedent: ${u.precedent.join(" ")}\n\n${u.task}\n\nreport done with data {verdict: ok|stub_mismatch|blocked, detail, frictions: []}`,
		}),
	),
);

// join serially as each finishes; a needs-input pauses that unit until `w.send(answer)`.
const frictions: string[] = [];
const replan: Array<{ id: string; detail?: string }> = [];
async function join(w: Worker) {
	for await (const o of w.events) {
		if (o.kind === "needs-input") { console.log(`${w.handle} asks: ${o.message.body}`); continue; } // answer: await w.send(...)
		if (o.kind === "done") {
			const d = (o.message.data ?? {}) as { verdict?: string; detail?: string; frictions?: string[] };
			frictions.push(...(d.frictions ?? []));
			if (d.verdict !== "ok") replan.push({ id: w.handle, detail: d.detail });
			else try { await merge(w); } catch (e) { if (e instanceof MergeConflict) console.log(`${w.handle} conflicts: ${e.files.join(" ")}`); else throw e; }
			await w.close();
			return;
		}
		if (o.kind === "blocked" || o.kind === "exited") { replan.push({ id: w.handle, detail: "message" in o ? o.message.body : o.tail }); return; }
	}
}
await Promise.all(workers.map(join));
console.log({ replan, frictions });
