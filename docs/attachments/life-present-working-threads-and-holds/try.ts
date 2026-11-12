// First-use entry point, not an acceptance suite. No writes to bb or the user's store.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { present } from "../../../extensions/context/life/present.ts";

const life = "/presence-first-use";
const p = present(life);

if (process.argv[2] === "probe") {
	const sibling = process.argv[3]!;
	console.log("SECOND PROCESS", process.pid);
	console.log(await p.snapshot());
	console.log("UNFINISHED SIBLING RUN", JSON.stringify(await p.readRun(sibling), null, 2));
	p.hold("plain-working", "");
	console.log("SECOND PROCESS CLEARED HOLD");
	process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "life-presence-"));
process.env.PI_BOARD_DIR = dir;
const threadIds = process.argv.slice(2);
const sibling = threadIds[0] ?? "presence-demo-sibling";
const file = join(dir, "sibling.jsonl");
const time = new Date().toISOString();
const entry = (id: string, parentId: string | null, message: object) =>
	({ type: "message", id, parentId, timestamp: time, message });
writeFileSync(file, [
	{ type: "session", id: "sibling-session", version: 3, timestamp: time, cwd: dir },
	entry("previous", null, { role: "assistant", content: [{ type: "text", text: "Previous run finished." }], stopReason: "stop" }),
	entry("question", "previous", { role: "user", content: "What are you holding?" }),
	entry("working", "question", { role: "assistant", content: [
		{ type: "text", text: "I am holding the import; this run is unfinished." },
	], stopReason: "toolUse" }),
].map((e) => JSON.stringify(e)).join("\n") + "\n");
// A live writer may be partway through its next append.
writeFileSync(file, '{"type":"message"', { flag: "a" });

const start = (session: string, thread?: string, pid = process.pid) => {
	const id = crypto.randomUUID();
	p.start({ id, session, thread, sessionFile: file, pid, time });
	return id;
};

try {
	const plain = start("plain-working");
	p.hold("plain-working", "import\nschema");
	const ended = start("plain-ended");
	p.end(ended);
	start("plain-dead", undefined, 2147483647);
	start("plain-detached");
	p.detach("plain-detached");
	start("sibling-session", sibling);
	for (const thread of threadIds.slice(1)) start("metadata-" + thread, thread);
	console.log("ISOLATED STORE", dir, "PARENT PROCESS", process.pid);
	console.log("BB METADATA IDS", JSON.stringify(threadIds));
	console.log("PARENT BEFORE PROBE\n" + await p.snapshot());
	const child = Bun.spawn([process.execPath, import.meta.path, "probe", sibling], {
		env: process.env, stdout: "inherit", stderr: "inherit",
	});
	const code = await child.exited;
	if (code) throw new Error("Probe exited " + code);
	console.log("PARENT AFTER CLEAR\n" + await p.snapshot());
	p.end(plain);
	console.log("PARENT AFTER END\n" + await p.snapshot());
	p.detach("sibling-session");
	console.log("PARENT AFTER DETACH\n" + await p.snapshot());
	console.log("SELF THREAD IDS (includes detached history)", JSON.stringify(p.threads()));
} finally {
	rmSync(dir, { recursive: true, force: true });
}
