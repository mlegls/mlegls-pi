// Offline rate-limit drill. BB emits the same typed data in its thread log and turn.failed hook.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";
import { start, stop } from "../../../lib/reconcile/main";
import { load } from "../../../lib/reconcile/reconcile";
import type { FakeBbThread } from "../../../lib/thread/fake-bb";

const f = protocolFixture();
let running = false;
const until = async <T>(read: () => T | undefined, what: string): Promise<T> => {
	for (const end = Date.now() + 45_000; Date.now() < end; await Bun.sleep(150)) {
		const value = read();
		if (value) return value;
	}
	throw new Error(what + ": " + JSON.stringify(load(f.cwd, "root")));
};
try {
	// A full window ensures the drill doesn't depend on the host's account or quota.
	const bin = join(f.root, "bin"), agents = process.env.PI_AGENTS_DIR!;
	mkdirSync(bin); mkdirSync(join(agents, "roles"), { recursive: true });
	writeFileSync(join(bin, "quota-axi"), "#!/bin/sh\nprintf '%s\\n' '{\"providers\":[]}'\n", { mode: 0o755 });
	process.env.PATH = bin + ":" + process.env.PATH;
	process.env.PI_RECONCILE_TICK_MS = "150";
	writeFileSync(join(agents, "provider-drill.md"), "---\nrole: implement\nmodel: codex/first:high, openai/second:low\n---\nProvider drill.\n");
	writeFileSync(join(agents, "roles/implement.md"), "Report by ending the turn.\n");
	f.tracker.update("root", { stage: "ticket", assignee: "agent:provider-drill" });
	f.bb.addThread("thr_fixture_owner");
	start({ cwd: f.cwd, root: "root", owner: "thr_fixture_owner", budget: 1 });
	running = true;
	const chain = () => load(f.cwd, "root")?.chains.root;
	const worker = (threadId: string | undefined) => f.bb.threads().find(t => t.id === threadId);
	const first = await until(() => worker(chain()?.handle?.bb), "first worker did not start");
	if (first.providerId !== "codex" || first.model !== "first") throw new Error("Wrong first worker: " + first.title);
	const path = join(f.bb.dir, "thread-" + first.id + ".json");
	const record = JSON.parse(readFileSync(path, "utf8")) as FakeBbThread;
	const scope = { kind: "turn", turnId: "turn-limited" }, createdAt = Date.now();
	writeFileSync(path, JSON.stringify({ ...record, status: "error", events: [
		{ seq: 1, type: "provider/error", scope, createdAt, data: { message: "Injected failure", errorInfo: { category: "rate-limit" } } },
		{ seq: 2, type: "turn/completed", scope, createdAt, data: { status: "failed" } },
	] }));
	const second = await until(() => chain()?.handle?.bb !== first.id ? worker(chain()?.handle?.bb) : undefined, "replacement did not start");
	if (second.providerId !== "pi" || second.model !== "openai/second" || chain()?.retries.provider !== 1)
		throw new Error("Wrong replacement: " + JSON.stringify(second));
	console.log(`${first.id} ${first.providerId}/${first.model} → ${second.id} ${second.providerId}/${second.model}; retries.provider=1`);
} finally {
	if (running) await stop(f.cwd, "root");
	f.close();
}
