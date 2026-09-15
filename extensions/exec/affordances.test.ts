import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ExtensionRunner, SessionManager, wrapRegisteredTools } from "@earendil-works/pi-coding-agent";
import { send } from "../board/store";
import { loadExtensions } from "../../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";

// Real pi loader, runner, session storage and wrapped tool. Only terminal/model UI is absent.
async function session(run: (s: { exec: (code: string, signal?: AbortSignal) => Promise<any>; runner: ExtensionRunner; sent: any[]; active: () => string[]; cwd: string; idle: (value: boolean) => void }) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-affordance-"));
	const oldBoard = process.env.PI_BOARD_DIR;
	process.env.PI_BOARD_DIR = join(cwd, "board");
	const loaded = await loadExtensions([resolve(import.meta.dir, "index.ts"), resolve(import.meta.dir, "../board/index.ts")], cwd);
	expect(loaded.errors).toEqual([]);
	const manager = SessionManager.inMemory(cwd);
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, cwd, manager, {} as any);
	const sent: any[] = [], errors: any[] = [];
	let idle = true;
	let active = ["read", "bash", "write", "exa_search", "board_read", "wm_spawn", "session_spawn", "session_wait", "session", "observe_ui", "act_ui", "launch_browser", "navigate_browser", "evaluate_browser", "exec"];
	runner.onError(error => errors.push(error));
	runner.bindCore({
		appendEntry: (kind: string, data: unknown) => manager.appendCustomEntry(kind, data),
		sendMessage: (message: unknown, options: unknown) => sent.push({ message, options }),
		getActiveTools: () => active,
		setActiveTools: (names: string[]) => { active = names; },
		getAllTools: () => runner.getAllRegisteredTools().map(t => t.definition),
	} as any, {
		getModel: () => undefined, getScopedModels: () => [], isIdle: () => idle,
		isProjectTrusted: () => true, getSignal: () => undefined, hasPendingMessages: () => false,
		getContextUsage: () => undefined, getSystemPrompt: () => "",
	} as any);
	const tool = wrapRegisteredTools(runner.getAllRegisteredTools(), runner).find(t => t.name === "exec")!;
	let id = 0;
	try {
		await runner.emit({ type: "session_start" } as any);
		await writeFile(join(cwd, "pixel.png"), Buffer.from(png, "base64"));
		await run({ cwd, runner, sent, idle: value => { idle = value; }, active: () => active, exec: async (code, signal) => {
			const callId = String(++id);
			const result = await tool.execute(callId, { code }, signal);
			const modified = await runner.emitToolResult({ type: "tool_result", toolName: "exec", toolCallId: callId, input: { code }, ...result, isError: false } as any);
			return { ...result, isError: false, ...modified };
		} });
		expect(errors).toEqual([]);
	} finally {
		await runner.emit({ type: "session_shutdown" } as any);
		if (oldBoard === undefined) delete process.env.PI_BOARD_DIR; else process.env.PI_BOARD_DIR = oldBoard;
		await rm(cwd, { recursive: true, force: true });
		await rm(`${cwd}__worktrees`, { recursive: true, force: true });
	}
}

const text = (r: any) => r.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");

test("read silently retains image; show emits model image, including before a later cell error", () => session(async ({ exec, active }) => {
	expect(active()).toEqual(["exec"]);
	const read = await exec('const image = await read("pixel.png");');
	expect(read.content.some((c: any) => c.type === "image")).toBe(false);
	const shown = await exec('await show(image);');
	expect(shown.content.find((c: any) => c.type === "image")).toMatchObject({ mimeType: "image/png" });
	expect(text(shown)).not.toContain(png);
	const failed = await exec('await show(image); throw new Error("after image");');
	expect(failed.isError).toBe(true);
	expect(text(failed)).toContain("after image");
	expect(failed.content.some((c: any) => c.type === "image")).toBe(true);
	const bounded = await exec('for (let i=0;i<10;i++) await show(image);');
	expect(bounded.content.filter((c: any) => c.type === "image").length).toBeLessThanOrEqual(8);
	expect(text(bounded)).toMatch(/image.*(limit|truncat)|(?:limit|truncat).*image/i);
	expect((await exec('await show(image);')).content.filter((c: any) => c.type === "image")).toHaveLength(1);
}), 20000);

async function until(predicate: () => boolean) {
	const deadline = Date.now() + 4000;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error("Expected delivery within 4s");
		await Bun.sleep(20);
	}
}

test("filtering a board read does not acknowledge hidden reports; explicit ack suppresses only selected wake", () => session(async ({ exec, sent, idle, runner }) => {
	idle(false);
	await exec('await board.subscribe({ topic: "verify/**", tags: "done", wake: true });');
	for (const body of ["selected", "hidden"]) send({ topic: "verify/worker", tags: ["done"], body, from: { session: "another-worker" } });
	const selected = await exec('const reports = await board.read({ topic: "verify/**" }); const selected = reports.messages.filter(m => m.body === "selected"); show(selected.map(m => m.body)); await board.ack(selected.map(m => m.id));');
	expect(selected.isError).toBe(false);
	expect(text(selected)).toContain("selected");
	expect(text(selected)).not.toContain("hidden");
	// A tree reset must preserve subscriptions and acknowledgments, not REPL bindings.
	await runner.emit({ type: "session_tree" } as any);
	idle(true);
	await until(() => sent.some(s => s.message.customType === "board"));
	const wakes = sent.filter(s => s.message.customType === "board");
	expect(wakes).toHaveLength(1);
	expect(wakes[0].message.content).toContain("hidden");
	expect(wakes[0].message.content).not.toContain("selected");
	expect(wakes[0].options.triggerTurn).toBe(true);
	expect(text(await exec('show(typeof reports);'))).toContain("undefined");
}), 20000);

test("Exa response stays structured across host RPC, filtering large bodies before display and retaining statuses/cost", async () => {
	const oldKey = process.env.EXA_API_KEY, oldUrl = process.env.EXA_API_URL;
	const requests: any[] = [];
	const server = Bun.serve({ port: 0, async fetch(req) {
		const body = await req.json();
		requests.push({ path: new URL(req.url).pathname, body });
		return Response.json({
			requestId: "fixture-request",
			results: [{ url: "https://discard.example", title: "discard", text: "x".repeat(100_000) }, { url: "https://keep.example", title: "keep", text: "evidence" }],
			statuses: [{ id: "https://missing.example", status: "error", error: { tag: "CRAWL_NOT_FOUND" } }],
			costDollars: { total: 0.007 },
		});
	} });
	process.env.EXA_API_KEY = "deterministic-local-fixture";
	process.env.EXA_API_URL = `http://127.0.0.1:${server.port}`;
	try {
		await session(async ({ exec }) => {
			const fetched = await exec('const search = await exa.search("evidence", {numResults: 2});');
			expect(fetched.isError).toBe(false);
			expect(text(fetched)).not.toContain("discard");
			const filtered = await exec('show(search.results.filter(r => r.title === "keep").map(r => r.text)); show(search.requestId, search.costDollars.total);');
			expect(text(filtered)).toContain("evidence");
			expect(text(filtered)).toContain("fixture-request");
			expect(text(filtered)).toContain("0.007");
			expect(text(filtered)).not.toContain("discard");
			const contents = await exec('const pages = await exa.contents(["https://keep.example", "https://missing.example"]); show(pages.statuses.filter(s => s.status === "error"));');
			expect(text(contents)).toContain("CRAWL_NOT_FOUND");
			expect(requests.map(r => r.path)).toEqual(["/search", "/contents"]);
			expect(requests[0].body).toMatchObject({query: "evidence", numResults: 2});
			expect(requests[1].body.urls).toEqual(["https://keep.example", "https://missing.example"]);
		});
	} finally {
		server.stop(true);
		if (oldKey === undefined) delete process.env.EXA_API_KEY; else process.env.EXA_API_KEY = oldKey;
		if (oldUrl === undefined) delete process.env.EXA_API_URL; else process.env.EXA_API_URL = oldUrl;
	}
}, 20000);

test.skipIf(process.env.PI_TEST_LOCAL_WM !== "1")("exec multi-spawn remembers workers across cells and waits any then all", () => session(async ({ exec, cwd }) => {
	const run = `exec-verify-${process.pid}-${Date.now()}`;
	const command = async (args: string[]) => {
		const p = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
		const [code, stderr] = await Promise.all([p.exited, new Response(p.stderr).text()]);
		if (code) throw new Error(stderr);
	};
	await command(["git", "init"]);
	await command(["git", "-c", "user.name=Verifier", "-c", "user.email=verify@example.invalid", "commit", "--allow-empty", "-m", "fixture"]);
	await writeFile(join(cwd, ".workmux.yaml"), "panes:\n  - command: <agent>\n    focus: true\n");
	try {
		const spawned = await exec(`const spawned = await wm.spawn({run:${JSON.stringify(run)},wake:false,workers:[{handle:"a",prompt:"fixture",agent:"sleep 120"},{handle:"b",prompt:"fixture",agent:"sleep 120"}]}); show(spawned.workers.map(w=>w.handle).sort());`);
		expect(spawned.isError).toBe(false);
		expect(text(spawned)).toContain("a");
		expect(text(spawned)).toContain("b");
		const report = (handle: string, body: string) => send({ topic: `${run}/${handle}`, tags: ["done"], body, from: { session: "external", name: handle } });
		const first = exec('show(await wm.wait({mode:"any",timeoutMs:5000}));');
		report("b", "first-report");
		expect(text(await first)).toContain("first-report");
		report("a", "second-report");
		report("b", "third-report");
		const all = await exec('const all = await wm.wait({mode:"all",timeoutMs:5000}); show(all.outcomes.map(o=>o.message.body).sort()); show(all.pending);');
		expect(text(all)).toContain("second-report");
		expect(text(all)).toContain("third-report");
		expect(text(all)).toContain("[]");
	} finally {
		await exec('await wm.close(["a","b"]);').catch(() => {});
		await command(["tmux", "kill-session", "-t", run]).catch(() => {});
	}
}), 30000);
