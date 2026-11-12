// Disposable first-use target. Keep prepare alive while driving the emitted RPC command.
// No tracker, real run, or BB thread is changed.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const scratch = resolve(import.meta.dir, "../../../.wm");
mkdirSync(scratch, { recursive: true });
const root = mkdtempSync(join(scratch, "notice-progress-"));
execFileSync("git", ["init", "-q", root]);
mkdirSync(join(root, ".git/reconcile"), { recursive: true });
mkdirSync(join(root, ".pi/extensions"), { recursive: true });
const extension = resolve(import.meta.dir, "../../../extensions/bb/local-completion.ts");
writeFileSync(join(root, ".pi/extensions/notices.ts"),
	"export { localCompletions as default } from " + JSON.stringify(extension) + ";\n");
const state = {
	backend: "threads", root: "notice-fixture", cwd: root, owner: "thr_fixtureowner", pid: process.pid,
	chains: { fixture: { handle: { run: "notice-fixture", handle: "fixture", path: root, bb: "thr_fixtureworker" }, workers: [] } },
	exceptions: {}, results: {}, landed: {}, landingOps: {}, refinements: {},
};
writeFileSync(join(root, ".git/reconcile/notice-fixture.json"), JSON.stringify(state, null, 2));
writeFileSync(join(root, "inputs.jsonl"), [
	"[reconcile notice-fixture] done: notice-fixture landed in the owner's checkout at abc123",
	"[reconcile notice-fixture] parked fixture behind dependency: its workers are retired and it restarts once they land",
	"[reconcile notice-fixture] withdrew the exception for fixture (waiting): worker resumed",
	"[reconcile notice-fixture] stopped with open work: fixture (idea)",
	"[bb message from thread:thr_fixtureworker]\n\nImplementation is committed; checking the changed surface.",
	"[reconcile notice-fixture] needs you: fixture — decision required",
].map(message => JSON.stringify({ type: "prompt", message })).join("\n") + "\n");
console.log("NOTICE_PROGRESS_READY " + root);
console.log("cd " + JSON.stringify(root) + " && pi --mode rpc --no-session --no-extensions -e .pi/extensions/notices.ts");
console.log("Inputs: " + join(root, "inputs.jsonl"));
await Bun.sleep(2_147_483_647);
