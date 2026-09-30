import { expect, jest, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ExtensionRunner, SessionManager, type CompactOptions, type ExtensionError } from "@earendil-works/pi-coding-agent";
import { loadExtensions } from "../../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js";

// Replays the replacement, ordinary idle and negative-eligibility checks in
// docs/attachments/memory-agent-settled-uses-stale-ctx/index.md at Pi's extension boundary.
// Real loader, runner (including stale-ctx enforcement) and session storage;
// fake clock and model response: no provider request or terminal needed.
interface SessionFixture { runner: ExtensionRunner; calls: CompactOptions[]; errors: ExtensionError[]; notices: string[]; attempts: () => Promise<any[]> }
async function fixture(run: (f: { start: (tokens?: boolean, children?: boolean) => Promise<SessionFixture> }) => Promise<void>) {
	const root = mkdtempSync(join(tmpdir(), "memory-lifecycle-"));
	const oldState = process.env.AB_STATE;
	process.env.AB_STATE = root;
	mkdirSync(join(root, ".pi"));
	writeFileSync(join(root, ".pi/settings.json"), JSON.stringify({ memory: { enabled: true, hibernate: { enabled: true, minTokens: 4000 } } }));
	const runners: ExtensionRunner[] = [];
	jest.useFakeTimers();
	try {
		await run({ start: async (tokens = true, children = true) => {
			const loaded = await loadExtensions([resolve(import.meta.dir, "index.ts")], root);
			expect(loaded.errors).toEqual([]);
			const dir = mkdtempSync(join(root, "session-"));
			const manager = SessionManager.create(root, dir);
			manager.appendMessage({ role: "user", content: tokens ? "word ".repeat(8000) : "short", timestamp: 1 });
			manager.appendMessage({ role: "user", content: "waiting", timestamp: 2 });
			const job = join(root, `supervise-${manager.getSessionId()}.json`);
			writeFileSync(job, JSON.stringify({ id: "a", type: "supervise", status: "running", input: { ticket: "t", ownerSession: manager.getSessionId() }, state: { children: children ? { x: {} } : {} } }));
			writeFileSync(join(root, "jobs.json"), JSON.stringify([job]));
			const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, root, manager, { streamSimple: () => ({ result: async () => ({
				stopReason: "stop", content: [{ type: "text", text: `tail: ${manager.getLeafId()}\n\nWaiting on child x. [@${manager.getBranch()[0].id}]` }],
			}) }) } as any);
			runners.push(runner);
			const calls: CompactOptions[] = [], errors: ExtensionError[] = [], notices: string[] = [];
			runner.onError(error => errors.push(error));
			const pending: Promise<unknown>[] = [];
			runner.bindCore({ getThinkingLevel: () => "off", getAllTools: () => [], getActiveTools: () => [] } as any, {
				getModel: () => ({ provider: "anthropic", id: "m" }), getScopedModels: () => [],
				isIdle: () => true, hasPendingMessages: () => false,
				getSystemPrompt: () => "",
				compact: (options: CompactOptions) => {
					calls.push(options);
					pending.push(runner.emit({ type: "session_before_compact", branchEntries: manager.getBranch(),
						preparation: { tokensBefore: 10000 }, signal: new AbortController().signal, customInstructions: options.customInstructions } as any));
				},
			} as any);
			runner.setUIContext({ ...runner.getUIContext(), notify: (text: string) => { notices.push(text); } });
			await runner.emit({ type: "session_start", reason: "startup" });
			return { runner, calls, errors, notices, attempts: async () => {
				await Promise.all(pending);
				const ledger = join(dir, "memory-attempts.jsonl");
				return existsSync(ledger) ? readFileSync(ledger, "utf8").trim().split("\n").map(line => JSON.parse(line)) : [];
			} };
		} });
	} finally {
		for (const runner of runners) await runner.emit({ type: "session_shutdown", reason: "quit" });
		jest.useRealTimers();
		if (oldState === undefined) delete process.env.AB_STATE; else process.env.AB_STATE = oldState;
		rmSync(root, { recursive: true, force: true });
	}
}

for (const reason of ["resume", "reload"] as const) {
	test(`${reason}: old timer and late agent_settled are inert after session replacement`, () => fixture(async ({ start }) => {
		const old = await start();
		const timer = spyOn(globalThis, "setTimeout");
		let queued: () => void;
		try {
			await old.runner.emit({ type: "agent_settled" });
			queued = timer.mock.calls.find(call => call[1] === 300_000)![0] as () => void;
		} finally { timer.mockRestore(); }
		// Pi replacement/reload shuts down the old runner before invalidating it.
		await old.runner.emit({ type: "session_shutdown", reason });
		old.runner.invalidate();
		const replacement = await start();
		await old.runner.emit({ type: "agent_settled" });
		expect(old.errors).toEqual([]);
		// A callback already dequeued at shutdown must also be harmless.
		expect(() => queued()).not.toThrow();
		jest.advanceTimersByTime(300_000);
		expect(old.calls).toEqual([]);
		expect(replacement.calls).toEqual([]);
		expect(await old.attempts()).toEqual([]);
		expect(await replacement.attempts()).toEqual([]);
		expect(old.notices).toEqual([]);
		expect(replacement.notices).toEqual([]);
		// New-session work uses its own fresh event context and idle interval.
		await replacement.runner.emit({ type: "agent_settled" });
		jest.advanceTimersByTime(300_000);
		expect(replacement.calls).toHaveLength(1);
		expect((await replacement.attempts()).map(a => a.trigger)).toEqual(["hibernate"]);
		expect(replacement.calls[0].customInstructions).toContain("t: x");
		expect(replacement.notices[0]).toContain("Hibernating: folding");
		expect(replacement.errors).toEqual([]);
	}));
}

test("eligible idle hibernates once; activity resets the deadline; shutdown cancels it", () => fixture(async ({ start }) => {
	const s = await start();
	await s.runner.emit({ type: "agent_settled" });
	jest.advanceTimersByTime(299_999);
	expect(s.calls).toEqual([]);
	await s.runner.emit({ type: "agent_start" });
	jest.advanceTimersByTime(1);
	expect(s.calls).toEqual([]);
	await s.runner.emit({ type: "agent_settled" });
	jest.advanceTimersByTime(299_999);
	expect(s.calls).toEqual([]);
	jest.advanceTimersByTime(1);
	expect(s.calls).toHaveLength(1);
	expect((await s.attempts()).map(a => a.trigger)).toEqual(["hibernate"]);
	expect(s.calls[0].customInstructions).toContain("t: x");
	jest.advanceTimersByTime(300_000);
	expect(s.calls).toHaveLength(1);
	await s.runner.emit({ type: "agent_settled" });
	await s.runner.emit({ type: "session_shutdown", reason: "quit" });
	jest.advanceTimersByTime(300_000);
	expect(s.calls).toHaveLength(1);
	expect((await s.attempts()).map(a => a.trigger)).toEqual(["hibernate"]);
	expect(s.errors).toEqual([]);
}));

for (const [name, tokens, children] of [["below threshold", false, true], ["without live children", true, false]] as const) {
	test(`ineligible supervisor ${name} does not hibernate`, () => fixture(async ({ start }) => {
		const s = await start(tokens, children);
		await s.runner.emit({ type: "agent_settled" });
		jest.advanceTimersByTime(3_600_000);
		expect(s.calls).toEqual([]);
		expect(await s.attempts()).toEqual([]);
		expect(s.notices).toEqual([]);
		expect(s.errors).toEqual([]);
	}));
}
