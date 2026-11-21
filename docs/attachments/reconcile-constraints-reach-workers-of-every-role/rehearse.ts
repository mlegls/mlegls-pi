// Supervisor rehearsal on an isolated Git/tracker target with fake BB workers.
import { spawnSync } from "node:child_process";
import { prepare, until } from "../../../lib/reconcile/setup-fixture";

const f = await prepare();
try {
	const backend = (file: "main" | "tool", args: string[], input?: unknown) => {
		const result = spawnSync(process.execPath, [new URL(`../../../lib/reconcile/${file}.ts`, import.meta.url).pathname, ...args], {
			cwd: f.repo, env: { ...process.env, BB_THREAD_ID: "thr_solo" }, encoding: "utf8",
			input: input === undefined ? undefined : JSON.stringify(input),
		});
		if (result.status !== 0) throw new Error(result.stderr || String(result.error));
		return JSON.parse(result.stdout);
	};
	const tell = (text: string, phase?: string) => backend("tool", ["reconcile_constrain"], { issue: "solo", node: "solo", text, phase });
	const implementOnly = "Merge the prepared branch before changing code.";
	const whileDriving = "Keep the upstream recordings when merging.";
	const all = "Use only the disposable vault.";
	const thread = (id?: string) => f.bb.threads().find(t => t.id === id)!;
	const implement = await f.ready("implement");
	console.log("implement instruction:", tell(implementOnly, "implement"), thread(implement.bb).tells);
	f.turn("needs-input\n\nThe fixture needs a retry before setup.");
	await until(() => f.state()?.exceptions.solo);
	backend("tool", ["reconcile_resolve"], { issue: "solo", node: "solo", action: "retry" });
	const retry = await until(() => { const h = f.state()?.chains.solo?.handle; return h && h.bb !== implement.bb && h; });
	console.log("implement retry prompt has instruction:", thread(retry.bb).prompt.includes(implementOnly));
	f.report({ entry: "bun app.ts" });
	const drive = await f.ready("drive");
	console.log("drive prompt has implement instruction:", thread(drive.bb).prompt.includes(implementOnly));
	console.log("implement instruction submitted during drive:", backend("main", ["constrain", "solo", "solo", whileDriving, "--phase", "implement"]));
	console.log("node-wide restriction:", tell(all), thread(drive.bb).tells);
	f.turn("done\n\n```json\n" + JSON.stringify({ stories: [{ story: "Run the disposable fixture", outcome: "held" }] }) + "\n```");
	const review = thread((await f.ready("review")).bb);
	console.log("review prompt:", { all: review.prompt.includes(all), implementOnly: review.prompt.includes(implementOnly), whileDriving: review.prompt.includes(whileDriving) });
	console.log("recorded:", backend("tool", ["reconcile_status"], { issue: "solo" })[0].constraints.solo);
} finally {
	await f.close();
}
