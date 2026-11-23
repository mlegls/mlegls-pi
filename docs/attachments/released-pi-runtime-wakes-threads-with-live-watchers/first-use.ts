// Prepare a real BB Pi thread in a disposable workspace for either release encounter.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getAgentDir, ProjectTrustStore } from "@earendil-works/pi-coding-agent";

const repo = resolve(import.meta.dir, "../../..");
const scratch = join(repo, ".wm");
const trust = new ProjectTrustStore(getAgentDir());
const bb = (...args: string[]) => JSON.parse(execFileSync(process.env.BB_CLI || "bb", [...args, "--json"], { encoding: "utf8" }));
const [mode, path] = process.argv.slice(2);
if (mode === "clean" && path) {
	const root = realpathSync(path);
	if (!root.startsWith(join(scratch, "watcher-first-use-"))) throw new Error("The workspace was not prepared by first-use.ts");
	const { id } = JSON.parse(readFileSync(join(root, "setup.json"), "utf8"));
	try {
		bb("thread", "archive", id);
		bb("thread", "stop", id);
	} finally { trust.set(root, null); }
} else if (mode === "release" || mode === "promise" || mode === "stop") {
	const project = process.env.BB_PROJECT_ID;
	if (!project) throw new Error("Set BB_PROJECT_ID to the BB project for this checkout");
	mkdirSync(scratch, { recursive: true });
	const root = mkdtempSync(join(scratch, "watcher-first-use-"));
	const ext = join(root, ".pi", "extensions");
	mkdirSync(ext, { recursive: true });
	const installedPackage = resolve(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"],
		{ cwd: repo, encoding: "utf8" }).trim(), "..");
	// Load candidate extensions instead of the installed package; keep installed pi-processes.
	writeFileSync(join(root, ".pi", "settings.json"), JSON.stringify({
		packages: [{ source: installedPackage, extensions: [], skills: [], prompts: [], themes: [] }],
	}));
	writeFileSync(join(ext, "watcher-first-use.ts"), String.raw`
import { appendFileSync } from "node:fs";
import bb from ${JSON.stringify(join(repo, "extensions", "bb", "index.ts"))};
import guard from ${JSON.stringify(join(repo, "extensions", "guard", "index.ts"))};
export default function (pi) {
	bb(pi);
	if (${mode === "promise"}) guard(pi);
	for (const name of ["session_start", "agent_settled", "session_shutdown"]) pi.on(name, (event, ctx) => {
		const file = ctx.sessionManager.getSessionFile();
		if (file) appendFileSync(ctx.cwd + "/runtime.jsonl", JSON.stringify({ name, pid: process.pid, file,
			at: new Date().toISOString(), aborted: event.aborted, reason: event.reason }) + "\n");
	});
}
`);
	trust.set(root, true);
	const common = "This is a disposable BB lifecycle rehearsal. Use the process tool to start sleep 300 as watcher-first-use; do not set a readiness pattern.";
	const final = mode === "promise" ? "When the watcher finishes, I'll publish." : "ready";
	const prompt = mode === "stop"
		? common + " Use one codemode invocation: await process start, then await process wait (action wait, id watcher-first-use, until exit, timeoutSeconds 180). Keep this turn running until the wait ends."
		: common + ` Do not wait for exit. End the turn with exactly this text: ${JSON.stringify(final)} If a runtime release notice arrives, reply ack and leave all processes stopped. Publishing is simulated; do not publish anything.`;
	const owner = process.env.BB_THREAD_ID;
	try {
		const { id } = bb("thread", "spawn", "--project", project, "--environment", root, "--provider", "pi",
			"--model", process.env.BB_WAKE_MODEL || "openai/gpt-6.2-sol", "--reasoning-level", "low",
			"--visibility", "hidden", ...(owner ? ["--lifecycle-owner-thread", owner] : []),
			"--title", "Managed watcher first use (" + mode + ")", "--prompt", prompt);
		const setup = { id, root, mode };
		writeFileSync(join(root, "setup.json"), JSON.stringify(setup));
		console.log(JSON.stringify(setup));
	} catch (error) { trust.set(root, null); throw error; }
} else {
	throw new Error("Use first-use.ts release | promise | stop | clean <owned workspace>");
}
