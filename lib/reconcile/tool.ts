// Bun entry point for the BB supervision plugin. Tool parameters are validated by BB;
// the working directory and BB_THREAD_ID come from the caller's thread, not its tool arguments.
import { dispatch, integrate, retire, type Assignment, type Handle } from "../dispatch";
import { readLive } from "../session-meta/live";
import { campaigns, constrain, resolveException, start, stop, summary } from "./main";
import { configure, status as pickupStatus, stopPickup } from "./pickup";

if (import.meta.main) {
	const owner = process.env.BB_THREAD_ID;
	if (!owner) throw new Error("The supervision tools require a BB thread");
	const cwd = process.cwd();
	const session = () => readLive().find(record => record.thread === owner && record.sessionFile)?.sessionId;
	const handlers = {
		dispatch: (p: { assignments: Assignment[]; run: string; maxConcurrent?: number; active?: Handle[] }) =>
			dispatch(p.assignments, { cwd, parentThread: owner, run: p.run, maxConcurrent: p.maxConcurrent ?? 8, active: p.active ?? [] }),
		async integrate(p: { worker: Handle | string; mode?: "rebase" | "merge"; keep?: boolean }) {
			try { return await integrate(p.worker, { cwd, mode: p.mode, keep: p.keep }); }
			catch (error) { if ((error as { files?: string[] }).files) return { conflict: true, ...(error as object), message: (error as Error).message }; throw error; }
		},
		retire: (p: { worker: Handle | string }) => retire(p.worker, { cwd }),
		reconcile: (p: { issue: string; budget?: number; land?: Parameters<typeof start>[0]["land"] }) =>
			start({ cwd, root: p.issue, owner, ownerSession: session(), budget: p.budget ?? 6, land: p.land }),
		reconcile_stop: (p: { issue: string }) => stop(cwd, p.issue),
		reconcile_status: (p: { issue?: string }) => campaigns(cwd).filter(s => !p.issue || s.root === p.issue).map(summary),
		reconcile_resolve: ({ issue, node, ...resolution }: { issue: string; node: string }) => {
			resolveException(cwd, issue, node, resolution);
			return { queued: true };
		},
		reconcile_constrain: (p: { issue: string; node: string; text: string; phase?: string }) => constrain(cwd, p.issue, p.node, p.text, p.phase),
		pickup: ({ settleSeconds, ...p }: Pick<Parameters<typeof configure>[0], "scope" | "budget" | "land" | "paused"> & { settleSeconds?: number }) =>
			configure({ ...p, cwd, owner, ownerSession: session(), settle: settleSeconds === undefined ? undefined : settleSeconds * 1000 }),
		pickup_status: () => pickupStatus(cwd),
		pickup_stop: () => stopPickup(cwd),
	};
	const name = process.argv[2];
	if (!Object.hasOwn(handlers, name)) throw new Error("Unknown supervision tool: " + name);
	const args = JSON.parse(await Bun.stdin.text());
	const result = await handlers[name as keyof typeof handlers](args);
	console.log(JSON.stringify(result ?? null));
}
