// Disposable first-use environment, not a reconciler execution test.
// prepare stays alive to supply the seeded run's liveness marker; seed records
// one explicitly named bb child as owned. No real tracker/run is modified.
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { saveThread } from "../../../lib/thread/registry.ts";

const [command, rootArg, child] = process.argv.slice(2);
const marker = ".notice-fixture.json";
if (command === "prepare") {
	const scratch = resolve(import.meta.dir, "../../../.wm");
	await mkdir(scratch, { recursive: true });
	// Keep the fixture under this already-trusted checkout so RPC loads its extension.
	const root = await mkdtemp(join(scratch, "reconciler-notice-"));
	execFileSync("git", ["init", "-q", root]);
	const stateHome = join(root, "state");
	await mkdir(join(root, ".pi", "extensions"), { recursive: true });
	await mkdir(join(root, ".wm"), { recursive: true });
	const extension = resolve(import.meta.dir, "../../../extensions/bb/index.ts");
	await writeFile(join(root, ".pi", "extensions", "bb-notices.ts"),
		"import notices from " + JSON.stringify(extension) + ";\n" +
		"import { appendFileSync, existsSync, readFileSync } from 'node:fs';\n" +
		"export default function(pi) { notices(pi); pi.on('before_provider_request', event => {\n" +
		" const payload = JSON.stringify(event.payload); const ownedFile = " + JSON.stringify(join(root, ".owned-child")) + "; const owned = existsSync(ownedFile) ? readFileSync(ownedFile, 'utf8') : null; appendFileSync(" + JSON.stringify(join(root, "requests.jsonl")) +
		", JSON.stringify({ thread: process.env.BB_THREAD_ID, at: Date.now(), ownedNotice: !!owned && payload.includes(owned), localReply: payload.includes('Worker completion noted.'), completionNotice: payload.includes('completed:') }) + '\\n');\n" +
		"}); }\n");
	await writeFile(join(root, ".wm", "launch.env"), "XDG_STATE_HOME=" + JSON.stringify(stateHome) + "\n");
	await writeFile(join(root, marker), JSON.stringify({ root, stateHome, pid: process.pid }));
	console.log("NOTICE_FIXTURE_READY " + root);
	await Bun.sleep(2_147_483_647);
} else if (command === "seed" && rootArg && child?.match(/^thr_[a-z0-9]+$/)) {
	const { root, stateHome, pid } = JSON.parse(await readFile(join(rootArg, marker), "utf8"));
	process.kill(pid, 0);
	process.env.XDG_STATE_HOME = stateHome;
	const id = randomUUID();
	const run = "notice-fixture";
	const handle = "owned-child";
	await saveThread({
		id, sessionId: id, sessionFile: join(root, "fixture-session.jsonl"),
		cwd: root, project: root, ownership: "guest", archived: false,
		created: new Date().toISOString(), bb: child, worker: { run, handle },
	});
	const directory = join(root, ".git", "reconcile");
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, run + ".json"), JSON.stringify({
		backend: "threads", root: run, cwd: root, pid,
		chains: { fixture: { handle: { run, handle, path: root, threadId: id }, workers: [] } },
	}));
	await writeFile(join(root, ".owned-child"), child);
	console.log("Owned " + child + " in " + root);
} else {
	throw new Error("usage: bun setup.ts prepare | seed <fixture-root> <bb-child-id>");
}
