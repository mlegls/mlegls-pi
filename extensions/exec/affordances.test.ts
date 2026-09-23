import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ExtensionRunner, SessionManager, wrapRegisteredTools } from "@earendil-works/pi-coding-agent";
import { loadExtensions } from "../../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js";
import manifest from "../../package.json";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";

// Real pi loader, runner, session storage and wrapped tool. Only terminal/model UI is absent.
async function session(run: (s: { exec: (code: string, signal?: AbortSignal) => Promise<any>; runner: ExtensionRunner; sent: any[]; active: () => string[]; cwd: string; idle: (value: boolean) => void }) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-affordance-"));
	const oldBoard = process.env.PI_BOARD_DIR, oldMode = process.env.PI_TOOL_MODE;
	process.env.PI_BOARD_DIR = join(cwd, "board");
	// An ambient PI_TOOL_MODE=bash (agent config) would make exec step aside.
	delete process.env.PI_TOOL_MODE;
	const paths = manifest.pi.extensions.filter(path => path.startsWith("./lib/") || path === "./extensions/exec/index.ts");
	const loaded = await loadExtensions(paths.map(path => resolve(import.meta.dir, "../..", path)), cwd);
	expect(loaded.errors).toEqual([]);
	const manager = SessionManager.inMemory(cwd);
	const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, cwd, manager, {} as any);
	const sent: any[] = [], errors: any[] = [];
	let idle = true;
	let active = ["read", "bash", "write", "exa_search", "board_read", "wm_spawn", "session_spawn", "session_wait", "session", "observe_ui", "act_ui", "launch_browser", "navigate_browser", "evaluate_browser", "exec"];
	runner.onError(error => errors.push(error));
	runner.bindCore({
		refreshTools() {},
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
		if (oldMode !== undefined) process.env.PI_TOOL_MODE = oldMode;
		await rm(cwd, { recursive: true, force: true });
		await rm(`${cwd}__worktrees`, { recursive: true, force: true });
	}
}

const text = (r: any) => r.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");

test("read silently retains image; show emits model image, including before a later cell error", () => session(async ({ exec, active }) => {
	expect(active()).toEqual(["exec"]);
	const read = await exec('state.image = await read("pixel.png");');
	expect(read.content.some((c: any) => c.type === "image")).toBe(false);
	const shown = await exec('await show(state.image);');
	expect(shown.content.find((c: any) => c.type === "image")).toMatchObject({ mimeType: "image/png" });
	expect(text(shown)).not.toContain(png);
	const failed = await exec('await show(state.image); throw new Error("after image");');
	expect(failed.isError).toBe(true);
	expect(text(failed)).toContain("after image");
	expect(failed.content.some((c: any) => c.type === "image")).toBe(true);
	const bounded = await exec('for (let i=0;i<10;i++) await show(state.image);');
	expect(bounded.content.filter((c: any) => c.type === "image").length).toBeLessThanOrEqual(8);
	expect(text(bounded)).toMatch(/image.*(limit|truncat)|(?:limit|truncat).*image/i);
	expect((await exec('await show(state.image);')).content.filter((c: any) => c.type === "image")).toHaveLength(1);
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
			const fetched = await exec('state.search = await exa.search("evidence", {numResults: 2});');
			expect(fetched.isError).toBe(false);
			expect(text(fetched)).not.toContain("discard");
			const filtered = await exec('show(state.search.results.filter(r => r.title === "keep").map(r => r.text)); show(state.search.requestId, state.search.costDollars.total);');
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
