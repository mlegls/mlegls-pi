import { expect, test } from "bun:test";
import desktopObservation from "./fixtures/desktop-observation-v0.5.1.json";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel, type KernelNotification, type KernelOptions } from "./kernel";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import sessionExtension from "../session";
import { TmuxTerminalManager, terminalServerName, tmuxAvailable } from "../session/tmux";
import { createComputerUseBridge } from "./computer-use";
import { createExecServices, type ExecServices } from "./services";

async function fixture(run: (kernel: Kernel, cwd: string, notices: KernelNotification[]) => Promise<void>, call?: KernelOptions["call"]) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-migration-"));
	const notices: KernelNotification[] = [];
	const kernel = new Kernel({ cwd, ledger: [], persist() {}, call, onNotification: n => notices.push(n) });
	try { await run(kernel, cwd, notices); }
	finally { await kernel.dispose(); await rm(cwd, { recursive: true, force: true }); }
}

async function cell(kernel: Kernel, code: string) {
	const result = await kernel.execute(code);
	if (result.error) throw new Error(result.error);
	return result;
}

async function until(predicate: () => boolean) {
	const deadline = Date.now() + 5000;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Expected host event within 5s");
		await Bun.sleep(10);
	}
}

test("shell results remain queryable while show and notify render literal streams, not object inspection", () => fixture(async (kernel, _cwd, notices) => {
	const command = "printf 'first\\nsecond\\n'; printf 'warning one\\nwarning two\\n' >&2; exit 7";
	expect((await cell(kernel, `const shellJob = sh(${JSON.stringify(command)}); const shellResult = await shellJob;`)).output).toBe("");
	const shown = (await cell(kernel, "await show(shellResult);")).output;
	expect(shown).toContain("first\nsecond\n");
	expect(shown).toContain("warning one\nwarning two\n");
	expect(shown).toMatch(/(?:exit|code)[^\n]*7/i);
	expect((await cell(kernel, "show(JSON.stringify([shellResult.stdout, shellResult.stderr, shellResult.exitCode, shellResult.stdoutTruncated, shellResult.stderrTruncated]));")).output.trim()).toBe(JSON.stringify(["first\nsecond\n", "warning one\nwarning two\n", 7, false, false]));
	const ordinary = (await cell(kernel, "show({...shellResult});")).output;
	expect(ordinary).toContain("stdout:");
	expect(ordinary).toContain("first\\nsecond\\n");
	await cell(kernel, 'notify(shellJob, "shell-report");');
	await until(() => notices.length === 1);
	expect(notices[0].label).toBe("shell-report");
	expect(notices[0].output.trimEnd()).toBe(shown.trimEnd());

	await cell(kernel, `const largeShell = await sh(${JSON.stringify("node -e 'process.stdout.write(\"x\".repeat(1100000));process.stderr.write(\"y\".repeat(1100000))'")});`);
	expect((await cell(kernel, "show(JSON.stringify([largeShell.stdout.slice(0,1048576).length, largeShell.stderr.slice(0,1048576).length, largeShell.stdoutTruncated, largeShell.stderrTruncated]));")).output.trim()).toBe(JSON.stringify([1024 * 1024, 1024 * 1024, true, true]));
	const bounded = (await cell(kernel, "show(largeShell);")).output;
	expect(bounded).toMatch(/stdout[^\n]*truncat/i);
	expect(bounded).toMatch(/stderr[^\n]*truncat/i);
	expect(bounded).toContain("[output truncated]");
	expect((await cell(kernel, "show(largeShell.stderr.slice(1000000,1000004));")).output).toBe("yyyy\n");
}), 20000);

test("write creates parents and overwrites; retained read anchors still protect intervening writes", () => fixture(async (kernel, cwd) => {
	await cell(kernel, 'await write("nested/example.ts", "const value = 1;\\n"); const original = await read("nested/example.ts"); await edit("=" + original.rows[0].anchor + "\\nconst value = 2;"); const edited = await read("nested/example.ts");');
	expect(await readFile(join(cwd, "nested/example.ts"), "utf8")).toBe("const value = 2;\n");
	await cell(kernel, 'await write("nested/example.ts", "const value = 3; // 奀\\n");');
	const stale = await kernel.execute('await edit("=" + edited.rows[0].anchor + "\\nconst value = 99;");');
	expect(stale.error).toMatch(/stale|changed|read.*again/i);
	expect(await readFile(join(cwd, "nested/example.ts"), "utf8")).toBe("const value = 3; // 奀\n");
	await cell(kernel, 'const fresh = await read("nested/example.ts"); await edit("=" + fresh.rows[0].anchor + "\\nconst value = 4;");');
	expect(await readFile(join(cwd, "nested/example.ts"), "utf8")).toBe("const value = 4;\n");
}), 15000);

// Session lifecycle stays in the host; only the Kernel child is disposable.
test.skipIf(!tmuxAvailable())("term sessions retain shell state across cancelled waits and kernel reset, then wait any/all", async () => {
	const lifecycle = new Map<string, (...args: any[]) => any>();
	const events = new EventEmitter();
	const sessionId = randomUUID();
	const manager = new TmuxTerminalManager(terminalServerName(sessionId));
	let waiting = false, cancelled = false;
	let services: ExecServices;
	const pi = {
		on: (name: string, handler: (...args: any[]) => any) => lifecycle.set(name, handler),
		events,
		sendMessage() {},
	} as any;
	sessionExtension(pi);
	try {
		await fixture(async (kernel, cwd) => {
			const ctx = { cwd, sessionManager: { getSessionId: () => sessionId, getBranch: () => [] } } as any;
			services = createExecServices(pi, ctx);
			await lifecycle.get("session_start")!({}, ctx);
			await cell(kernel, 'const terminals = await term.spawn({terminals:[{name:"left",command:"sh"},{name:"right",command:"sh"}]}); await term.send("left", "value=41"); const cursors = Object.fromEntries((await Promise.all(terminals.map(t=>term.view(t.id)))).map(t=>[t.id,t.cursor])); const changed = term.wait({ids:["left","right"],mode:"any",cursors,waitMs:5000});');
			await cell(kernel, 'await term.send("left", "echo answer=$((value+1))", {submit:false}); await term.sendRaw("left", ["Enter"]);');
			const change = JSON.parse((await cell(kernel, 'show(JSON.stringify(await changed));')).output);
			expect((await cell(kernel, 'show((await term.view("left")).output);')).output).toContain("answer=42");
			expect(change.changed).toEqual(["left"]);
			expect(change.timedOut).not.toBe(true);
			expect(change.snapshots.find((s: any) => s.id === "right").status).toBe("running");

			waiting = false;
			const controller = new AbortController();
			const pending = kernel.execute('await term.wait({ids:["left","right"],mode:"all",waitMs:30000});', controller.signal);
			await until(() => waiting);
			controller.abort();
			expect((await pending).error).toMatch(/cancel/i);
			await until(() => cancelled);
			expect((await cell(kernel, 'show(typeof terminals); show((await term.list()).map(t=>t.id).sort().join(","));')).output).toBe("undefined\nleft,right\n");
			await cell(kernel, 'await term.send("left", "echo survived=$((value+1))");');
			expect((await cell(kernel, 'show((await term.view("left", {lines:50})).output);')).output).toContain("survived=42");
			await cell(kernel, 'await term.send("left", "exit 3"); await term.send("right", "exit 4");');
			const all = JSON.parse((await cell(kernel, 'show(JSON.stringify(await term.wait({ids:["left","right"],mode:"all",waitMs:5000})));')).output);
			expect(all.timedOut).not.toBe(true);
			expect(all.snapshots.map((s: any) => [s.id, s.status, s.exitCode]).sort()).toEqual([["left", "exited", 3], ["right", "exited", 4]]);
			expect((await cell(kernel, 'const ended = await term.end("left"); show(ended.id, ended.ended); await term.end("right"); show((await term.list()).length);')).output).toBe("left true\n0\n");
		}, ({ namespace, method, args, signal }) => {
			if (namespace !== "term") throw new Error("Unexpected namespace " + namespace);
			if (method === "wait") {
				waiting = true;
			}
			return services.call({ namespace, method, args, signal }).finally(() => { if (signal.aborted) cancelled = true; });
		});
	} finally {
		await lifecycle.get("session_shutdown")?.({});
		await manager.killServer();
	}
}, 30000);


const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";

// Captured from pi-computer-use 0.5.1 observe_ui on Zed, 2026-09-15.
// Keep the native restoration payload; content below independently exercises transport ordering.
test("UI observations cross real Kernel RPC with ordered images, reusable refs and state, and visible errors", async () => {
	const requests: Array<{ name: string; args: unknown }> = [];
	const saved: any[] = [];
	let branch: any[] = [], backendState: string | undefined;
	const lifecycle = new Map<string, (...args: any[]) => any>();
	let releaseLate: (() => void) | undefined, lateSettled = false;
	const pi = {
		registerTool() { throw new Error("Direct runtime must not register tools"); },
		on: (name: string, handler: (...args: any[]) => any) => lifecycle.set(name, handler),
		appendEntry: (customType: string, data: unknown) => {
			const entry = { type: "custom", customType, data, id: String(saved.length), timestamp: new Date().toISOString() };
			saved.push(entry); branch.push(entry);
		},
	} as any;
	let services: ExecServices;
	const bridge = await createComputerUseBridge(pi, () => {
		const methods: Record<string, (args: any) => any> = {};
		let dirty = false;
		const register = (name: string, execute: (args: any) => any) => {
			methods[name] = async (args: any) => { requests.push({ name, args }); return execute(args); };
		};
		// The desktop backend is the only substituted boundary; no image or display mock.
		register("observe_ui", () => {
			dirty = true;
			backendState = "3c0c1d71-f059-4c97-b436-4cadb5aa752c";
			return {
			content: [
				{ type: "text", text: "state: 3c0c1d71-f059-4c97-b436-4cadb5aa752c\n@e2 button Save" },
				{ type: "image", data: pixel, mimeType: "image/png" },
				{ type: "text", text: "detail crop" },
				{ type: "image", data: pixel, mimeType: "image/png" },
				{ type: "text", text: "end observation" },
			],
			details: desktopObservation,
			};
		});
		register("inspect_ui", ({ ref, stateId }) => {
			if (stateId !== backendState) throw new Error("UI state unavailable; observe again");
			if (ref === "@delayed") return new Promise(resolve => {
				releaseLate = () => { backendState = "late-state"; dirty = true; resolve({ content: [{ type: "text", text: "late completion" }], details: { ...desktopObservation, capture: { ...desktopObservation.capture, stateId: "late-state" } } }); };
			});
			if (ref === "@missing") throw new Error("UI ref @missing expired; observe again");
			return { content: [{ type: "text", text: "Save is enabled" }], details: { stateId: "3c0c1d71-f059-4c97-b436-4cadb5aa752c", ref } };
		});
		register("act_ui", () => ({
			isError: true,
			content: [{ type: "text", text: "Action refused: stale state" }, { type: "image", data: pixel, mimeType: "image/png" }],
			details: { stateId: "desktop-2" },
		}));
		return {
			observe: methods.observe_ui, inspect: methods.inspect_ui, act: methods.act_ui,
			help: () => [],
			exportSnapshot(options: { incremental?: boolean } = {}) {
				expect(options.incremental).toBe(true);
				if (!dirty) return { version: 1, incremental: true };
				dirty = false;
				// An opaque backend payload: the adapter must round-trip it without interpretation.
				return { version: 1, incremental: true, observation: { ...desktopObservation, capture: { ...desktopObservation.capture, stateId: backendState } } };
			},
			async restoreSnapshot(snapshot: any) { if (snapshot.observation) backendState = snapshot.observation.capture.stateId; },
			async reset() { backendState = undefined; dirty = false; },
			async close() { backendState = undefined; },
		} as any;
	});
	await fixture(async (kernel, cwd) => {
		const ctx = { cwd, sessionManager: { getSessionId: () => "ui-migration", getBranch: () => branch } } as any;
		services = createExecServices(pi, ctx, { ui: bridge });
		await lifecycle.get("session_start")!({}, ctx);
		expect((await cell(kernel, 'const observation = await ui.observe({root:"@r3",mode:"visual"});')).content).toEqual([]);
		const shown = await cell(kernel, 'await show(observation);');
		expect(shown.content.map(c => c.type)).toEqual(["text", "image", "text", "image", "text"]);
		expect(shown.content.filter(c => c.type === "text").map(c => c.text.trim())).toEqual(["state: 3c0c1d71-f059-4c97-b436-4cadb5aa752c\n@e2 button Save", "detail crop", "end observation"]);
		expect(shown.content.filter(c => c.type === "image")).toEqual([{ type: "image", data: pixel, mimeType: "image/png" }, { type: "image", data: pixel, mimeType: "image/png" }]);
		const inspected = (await cell(kernel, 'show(JSON.stringify(observation)); show({...observation});')).output;
		expect(inspected).not.toContain(pixel);
		expect(inspected).toContain("3c0c1d71-f059-4c97-b436-4cadb5aa752c");
		expect(inspected).toContain("@e2");
		expect(shown.output).not.toContain(pixel);
		await cell(kernel, 'const inspectedRef = await ui.inspect({stateId:observation.capture.stateId,ref:observation.details.outline.root.children[0].ref}); await show(inspectedRef);');
		expect(requests.slice(0, 2)).toEqual([
			{ name: "observe_ui", args: { root: "@r3", mode: "visual" } },
			{ name: "inspect_ui", args: { stateId: "3c0c1d71-f059-4c97-b436-4cadb5aa752c", ref: "@e2" } },
		]);
		const failed = await kernel.execute('await show(observation); await ui.inspect({stateId:observation.capture.stateId,ref:"@missing"});');
		expect(failed.error).toContain("UI ref @missing expired; observe again");
		expect(failed.content.filter(c => c.type === "image")).toHaveLength(2);
		const refused = await kernel.execute('const refused = await ui.act({stateId:observation.capture.stateId,actions:[{ref:observation.details.outline.root.children[0].ref,action:"press"}]}); show(refused.isError, refused.details.stateId); await show(refused);');
		expect(refused.error).toContain("UI operation failed");
		expect(refused.output).toContain("true desktop-2");
		expect(refused.output).toContain("Action refused: stale state");
		expect(refused.content.filter(c => c.type === "image")).toHaveLength(1);
		expect((await cell(kernel, 'show(typeof ui.navigate, typeof ui.evaluate, typeof ui.launchBrowser);')).output).toBe("undefined undefined undefined\n");
		expect(JSON.stringify(saved)).not.toContain(pixel);
		expect(saved).toHaveLength(3); // Observation, cached inspect, and refused action each export a delta.
		expect(saved.filter(entry => entry.data.snapshot.observation)).toHaveLength(1);
		expect(saved[0].data.snapshot.observation.capture.stateId).toBe(desktopObservation.capture.stateId);
		expect(saved[0].data.snapshot.observation.outline.root).toEqual(desktopObservation.outline.root);

		// Restore the real earlier journal after an interrupted backend finishes late.
		const beforeLate = saved.length;
		const controller = new AbortController();
		const pending = kernel.execute('await ui.inspect({stateId:"3c0c1d71-f059-4c97-b436-4cadb5aa752c",ref:"@delayed"});', controller.signal);
		await until(() => releaseLate !== undefined);
		controller.abort();
		expect((await pending).error).toMatch(/cancel/i);
		branch = saved.slice(0, 1);
		const restored = lifecycle.get("session_tree")!({}, ctx);
		releaseLate!();
		await restored;
		await until(() => lateSettled);
		expect(saved).toHaveLength(beforeLate);
		expect((await cell(kernel, 'show(typeof observation); await show(await ui.inspect({stateId:"3c0c1d71-f059-4c97-b436-4cadb5aa752c",ref:"@e2"}));')).output).toContain("undefined\nSave is enabled");
		branch = [];
		await lifecycle.get("session_tree")!({}, ctx);
		expect((await kernel.execute('await ui.inspect({stateId:"3c0c1d71-f059-4c97-b436-4cadb5aa752c",ref:"@e2"});')).error).toContain("UI state unavailable");
		await lifecycle.get("session_shutdown")!({}, ctx);
	}, ({ namespace, method, args, signal }) => {
		if (namespace !== "ui") throw new Error("Unexpected namespace " + namespace);
		return services.call({ namespace, method, args, signal }).finally(() => { if (signal.aborted) lateSettled = true; });
	});
}, 20000);
