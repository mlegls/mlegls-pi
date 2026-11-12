// Run from the repository: PI_BOARD_DIR=$(mktemp -d) bun docs/attachments/life-log-copies-and-orders-runs/first-use.ts
// The caller owns the fresh PI_BOARD_DIR. This leaves records.db for inspection, but removes source sessions.
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionChain } from "../../../lib/records/branch.ts";
import { db, write } from "../../../lib/records/store.ts";
import { lifeId, lifeLog, lifeMessages } from "../../../extensions/context/life/log.ts";

const root = process.env.PI_BOARD_DIR;
if (!root) throw new Error("Set PI_BOARD_DIR to a fresh temporary directory.");
const log = lifeLog("/first-use");
const sources = join(root, "sessions");
const gate = join(root, "go");
const context = (sm: SessionManager, place: string) => ({
	session: sm.getSessionId(), sessions: sessionChain(sm), place,
	model: "initial/model", selfThreads: ["sibling"],
});
const assistant = (model: string, content: any[]) => ({
	role: "assistant", api: "anthropic-messages", provider: "demo", model, content,
	stopReason: "stop", timestamp: Date.now(),
}) as any;

if (process.argv[2] === "append") {
	const [path, place] = process.argv.slice(3);
	const sm = SessionManager.open(path!);
	const input = lifeMessages(sm.getBranch(), context(sm, place!));
	db();
	writeFileSync(join(root, place! + ".ready"), "");
	while (!existsSync(gate)) await Bun.sleep(10);
	const added = log.append(input);
	console.log(JSON.stringify({ process: place, added: added.map((m) => m.pos), repeat: log.append(input).length }));
} else {
	mkdirSync(sources);
	const paths = ["one", "two"].map((place) => {
		const sm = SessionManager.create(process.cwd(), sources);
		sm.appendModelChange("demo", "first");
		sm.appendMessage({ role: "user", content: place + ": start", timestamp: Date.now() });
		sm.appendMessage(assistant("reply", [
			{ type: "thinking", thinking: "private" },
			{ type: "text", text: place + ": working" },
			{ type: "toolCall", id: "read1", name: "read", arguments: { path: "x" } },
		]));
		sm.appendMessage({ role: "toolResult", toolCallId: "read1", toolName: "read", content: [{ type: "text", text: place + ": output" }], isError: false, timestamp: Date.now() });
		sm.appendModelChange("demo", "next");
		sm.appendMessage({ role: "user", content: "[bb message from thread:sibling] " + place + ": elsewhere", timestamp: Date.now() });
		sm.appendMessage({ role: "user", content: "[bb message from thread:worker] " + place + ": report", timestamp: Date.now() });
		sm.appendMessage(assistant("next", [{ type: "text", text: place + ": finished" }]));
		return sm.getSessionFile()!;
	});
	write({ schema: "optmem", body: "old memory remains unread", tags: [{ key: "life.id", value: log.id }] });
	const children = paths.map((path, i) => Bun.spawn([process.execPath, import.meta.path, "append", path, ["one", "two"][i]!], { stdout: "pipe", stderr: "pipe" }));
	while (!["one", "two"].every((place) => existsSync(join(root, place + ".ready")))) {
		if (children.some((p) => p.exitCode !== null)) throw new Error("Appender exited before readiness.");
		await Bun.sleep(10);
	}
	writeFileSync(gate, "");
	for (const p of children) {
		const exit = await p.exited;
		console.log((await new Response(p.stdout).text()).trim());
		if (exit) throw new Error(await new Response(p.stderr).text());
	}
	const fork = SessionManager.open(paths[0]!);
	fork.createBranchedSession(fork.getLeafId()!);
	fork.appendMessage({ role: "user", content: "fork: new branch", timestamp: Date.now() });
	fork.appendMessage(assistant("fork-model", [{ type: "text", text: "fork: finished" }]));
	const inherited = lifeMessages(fork.getBranch(), context(fork, "fork"));
	console.log(JSON.stringify({ fork: fork.getSessionId(), chain: sessionChain(fork), inherited: inherited.slice(0, 7).map((m) => m.source), added: log.append(inherited) }));
	rmSync(sources, { recursive: true });
	console.log(JSON.stringify({ sourceFilesExist: paths.some(existsSync), project: lifeId("first-use", process.cwd()), machine: lifeId("/first-use", "/tmp"), records: log.read() }, null, 2));
	console.log("Inspect with PI_BOARD_DIR=" + root);
}
