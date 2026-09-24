import { describe, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { install as sessionMeta, spawnMeta } from "./host";

type Handler = (event: unknown, ctx: ExtensionContext) => void;
type Entry = { type: "custom"; customType: string; data: unknown };

function host() {
	const entries: Entry[] = [];
	const handlers = new Map<string, Handler>();
	const ctx = { sessionManager: { getBranch: () => entries } } as unknown as ExtensionContext;
	const api = {
		on: (name: string, handler: Handler) => handlers.set(name, handler),
		appendEntry: (customType: string, data: unknown) => entries.push({ type: "custom", customType, data: structuredClone(data) }),
	} as unknown as ExtensionAPI;
	return { entries, api, start: () => handlers.get("session_start")!({}, ctx) };
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

	test("reads Paseo's agent id, alone or beside wm's", () => {
		expect(spawnMeta({ PASEO_AGENT_ID: "p1" })).toEqual({ paseoAgent: "p1" });
		expect(spawnMeta({ PASEO_AGENT_ID: "p1", PI_WM_RUN: "r", PI_WM_HANDLE: "h" }))
			.toEqual({ run: "r", handle: "h", agent: undefined, parentSession: undefined, paseoAgent: "p1" });
	});

	test("omits optional provenance", () => {
		expect(spawnMeta({ PI_WM_RUN: "r", PI_WM_HANDLE: "h" })).toEqual({ run: "r", handle: "h", agent: undefined, parentSession: undefined });
	});
});

describe("extension", () => {
	test("records one entry at session start", () => {
		withEnv({ PI_WM_RUN: "run", PI_WM_HANDLE: "handle", PI_WM_AGENT: "auto", PASEO_AGENT_ID: undefined }, () => {
			const h = host();
			sessionMeta(h.api);
			h.start();
			expect(h.entries).toEqual([{ type: "custom", customType: "session-meta", data: { run: "run", handle: "handle", agent: "auto", parentSession: undefined } }]);
			h.start();
			expect(h.entries).toHaveLength(1);
		});
	});

	test("stays absent without wm or Paseo env", () => {
		withEnv({ PI_WM_RUN: undefined, PI_WM_HANDLE: undefined, PASEO_AGENT_ID: undefined }, () => {
			const h = host();
			sessionMeta(h.api);
			expect(h.entries).toHaveLength(0);
		});
	});
});