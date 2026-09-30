import { afterEach, describe, expect, test } from "bun:test";
import { SessionManager, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install as sessionMeta, spawnMeta } from "./host";

type Handler = (event: unknown, ctx: ExtensionContext) => void;
type Entry = { type: "custom"; customType: string; data: unknown };
const active = new Set<() => void>();
afterEach(() => { for (const stop of active) stop(); active.clear(); });

function host(manager?: SessionManager) {
	const entries: Entry[] = [];
	const handlers = new Map<string, Handler>();
	const ctx = { mode: "tui", sessionManager: { getBranch: () => manager?.getBranch() ?? entries } } as unknown as ExtensionContext;
	const api = {
		on: (name: string, handler: Handler) => handlers.set(name, handler),
		appendEntry: (customType: string, data: unknown) => {
			entries.push({ type: "custom", customType, data: structuredClone(data) });
			manager?.appendCustomEntry(customType, data);
		},
	} as unknown as ExtensionAPI;
	const stop = () => handlers.get("session_shutdown")?.({}, ctx);
	active.add(stop);
	return { entries, api, start: (mode: ExtensionContext["mode"] = "tui") => handlers.get("session_start")!({}, { ...ctx, mode }) };
}

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
	const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
	for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v);
	try { run(); } finally {
		for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
	}
}

describe("spawnMeta", () => {
	test("reads wm's env", () => {
		expect(spawnMeta({ PI_WM_RUN: "reorg/0918", PI_WM_HANDLE: "a", PI_WM_AGENT: "auto", PI_WM_PARENT_SESSION: "s1" }))
			.toEqual({ run: "reorg/0918", handle: "a", agent: "auto", parentSession: "s1" });
	});

	test("undefined without run and handle", () => {
		expect(spawnMeta({})).toBeUndefined();
		expect(spawnMeta({ PI_WM_RUN: "r" })).toBeUndefined();
	});

	test("omits optional provenance", () => {
		expect(spawnMeta({ PI_WM_RUN: "r", PI_WM_HANDLE: "h" })).toEqual({ run: "r", handle: "h", agent: undefined, parentSession: undefined });
	});
});

// Replays docs/attachments/session-meta-tests-ignore-inherited-wm-parent-session/index.md.
describe("extension", () => {
	// Drive checks 1 and 3: ambient parent isolation and in-process restoration.
	test.each(["drive-probe-parent", undefined])("records one entry at session start with ambient parent %s", (parent) => {
		withEnv({ PI_WM_PARENT_SESSION: parent }, () => {
			withEnv({ PI_WM_RUN: "run", PI_WM_HANDLE: "handle", PI_WM_AGENT: "auto", PI_WM_PARENT_SESSION: undefined, PI_SESSION_ID: undefined }, () => {
				expect(process.env.PI_WM_PARENT_SESSION).toBeUndefined();
				const h = host();
				sessionMeta(h.api);
				h.start();
				expect(h.entries).toEqual([{ type: "custom", customType: "session-meta", data: { run: "run", handle: "handle", agent: "auto", parentSession: undefined, mode: "tui" } }]);
				h.start();
				expect(h.entries).toHaveLength(1);
			});
			expect(process.env.PI_WM_PARENT_SESSION).toBe(parent);
		});
	});

	// Drive check 2: inspect persisted provenance, using a seeded turn instead of a provider.
	test.each(["drive-probe-parent", undefined])("persists parent provenance %s", (parent) => {
		const dir = mkdtempSync(join(tmpdir(), "session-meta-test-"));
		try {
			withEnv({ PI_WM_RUN: "run", PI_WM_HANDLE: "handle", PI_WM_AGENT: "auto", PI_WM_PARENT_SESSION: parent, PI_SESSION_ID: undefined }, () => {
				const manager = SessionManager.create(dir, dir);
				const h = host(manager);
				sessionMeta(h.api);
				h.start();
				// Pi buffers new sessions until their first assistant message.
				manager.appendMessage({
					role: "assistant", content: [{ type: "text", text: "OK" }],
					api: "openai-completions", provider: "test", model: "test",
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
					stopReason: "stop", timestamp: Date.now(),
				});
				const entries = readFileSync(manager.getSessionFile()!, "utf8").trim().split("\n").map(line => JSON.parse(line));
				const metadata = entries.filter(entry => entry.type === "custom" && entry.customType === "session-meta");
				expect(metadata).toHaveLength(1);
				expect(metadata[0].data).toEqual({ run: "run", handle: "handle", agent: "auto", mode: "tui",
					...(parent === undefined ? {} : { parentSession: parent }) });
				if (parent === undefined) expect(metadata[0].data).not.toHaveProperty("parentSession");
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("records launch mode without spawn metadata, only once across resumes", () => {
		withEnv({ PI_WM_RUN: undefined, PI_WM_HANDLE: undefined, PI_SESSION_ID: undefined }, () => {
			const h = host();
			sessionMeta(h.api);
			h.start("print");
			expect(h.entries).toEqual([{ type: "custom", customType: "session-meta", data: { mode: "print" } }]);
			h.start("tui");
			expect(h.entries).toHaveLength(1);
		});
	});
});
describe("invokedBy", () => {
	test("records the calling session for headless children, not for wm workers", () => {
		expect(spawnMeta({ PI_SESSION_ID: "parent" })).toEqual({ invokedBy: "parent" });
		expect(spawnMeta({ PI_SESSION_ID: "parent", PI_WM_RUN: "r", PI_WM_HANDLE: "h" })).toEqual({ run: "r", handle: "h", agent: undefined, parentSession: undefined });
	});
});
