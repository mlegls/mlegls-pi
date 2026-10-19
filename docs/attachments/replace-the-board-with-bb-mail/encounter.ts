// Replayable first-use setup for the residual tracker-plugin join; no shared roles or real messages are changed.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFakePluginHost, makeThreadResponse } from "../../../bb/tracker/node_modules/@get-bb/plugin-sdk/dist/testing/index.js";
import plugin from "../../../bb/tracker/server";
import { setRole, clearRole } from "../../../lib/desk";

const top = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = join(top, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const threadId = process.env.BB_THREAD_ID;
if (!threadId) throw new Error("Run from an existing bb thread (BB_THREAD_ID); no thread will be messaged.");
const root = mkdtempSync(join(tmpdir(), "bb-coordination-join-"));
const previousState = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = join(root, ".state");
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
let dispose: (() => Promise<void>) | undefined;
try {
	git("init", "-b", "main");
	git("config", "user.name", "Coordination fixture");
	git("config", "user.email", "fixture@example.invalid");
	git("commit", "--allow-empty", "-m", "Initialize disposable coordination fixture");
	mkdirSync(join(root, "docs/issues"), { recursive: true });
	execFileSync(process.execPath, [script, "create", "ready-fixture", "--fields", JSON.stringify({ stage: "ticket", assignee: "agent", author: "session:coordination-fixture" }), "--body-file", "-"], { cwd: root, input: "Disposable fixture: exercise tracker supervisor routing only.\n", stdio: ["pipe", "pipe", "pipe"] });
	await setRole("supervisor", threadId, root);
	let listed = [makeThreadResponse({ id: threadId, title: "Standing supervisor", status: "active" })];
	const { bb, harness } = createFakePluginHost({
		pluginId: "coordination-join-fixture",
		settings: { trackerScript: script, bun: process.execPath },
		sdk: {
			projects: { list: async () => [{ id: "proj_fixture", name: "Disposable coordination", sources: [{ path: root }] }] },
			threads: {
				list: async () => listed,
				experimental_listPluginMetadata: async () => ({ threads: listed.map(t => ({ threadId: t.id, metadata: {} })) }),
				send: async () => ({}),
				getPluginMetadata: async () => ({}),
				updatePluginMetadata: async () => ({}),
			},
		},
	});
	dispose = () => harness.lifecycle.dispose();
	await plugin(bb);
	const rpc = (method: string, input: unknown) => harness.behavior.callRpc(method, input);
	console.log("supervisors", JSON.stringify(await rpc("supervisors", { projectId: "proj_fixture" })));
	console.log("role delivery", JSON.stringify(await rpc("supervise", { projectId: "proj_fixture", slugs: ["ready-fixture"], target: { kind: "role" } })));
	console.log("explicit delivery", JSON.stringify(await rpc("supervise", { projectId: "proj_fixture", slugs: ["ready-fixture"], target: { kind: "thread", threadId } })));
	console.log("captured sends (SDK fixture, not live bb)", JSON.stringify(harness.inspection.sdk.callsTo("threads.send")));
	listed = [];
	console.log("deleted/archived role omitted", JSON.stringify(await rpc("supervisors", { projectId: "proj_fixture" })));
	try { console.log(await rpc("supervise", { projectId: "proj_fixture", slugs: ["ready-fixture"], target: { kind: "role" } })); }
	catch (error) { console.log("unavailable role", String(error)); }
	await clearRole("supervisor", threadId, root);
	console.log("absent role", JSON.stringify(await rpc("supervisors", { projectId: "proj_fixture" })));
} finally {
	await dispose?.();
	if (previousState === undefined) delete process.env.XDG_STATE_HOME;
	else process.env.XDG_STATE_HOME = previousState;
	rmSync(root, { recursive: true, force: true });
	console.log("Removed disposable checkout", root);
}
