import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import exaExtension from "./index";

interface RegisteredTool {
	name: string;
	execute: (...args: any[]) => Promise<{ content: Array<{ type: string; text: string }>; details: Record<string, unknown> }>;
}

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.EXA_API_KEY;
const originalApiUrl = process.env.EXA_API_URL;

function registeredTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	exaExtension({
		registerTool(tool: RegisteredTool) {
			tools.set(tool.name, tool);
		},
	} as unknown as ExtensionAPI);
	return tools;
}

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	process.env.EXA_API_KEY = "test-key";
	delete process.env.EXA_API_URL;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalApiKey === undefined) delete process.env.EXA_API_KEY;
	else process.env.EXA_API_KEY = originalApiKey;
	if (originalApiUrl === undefined) delete process.env.EXA_API_URL;
	else process.env.EXA_API_URL = originalApiUrl;
});

describe("Exa extension", () => {
	test("searches with token-efficient contents and formats source metadata", async () => {
		let request: { url: string; init: RequestInit } | undefined;
		globalThis.fetch = (async (url, init) => {
			request = { url: String(url), init: init ?? {} };
			return response({
				requestId: "request-1",
				results: [{
					title: "Primary source",
					url: "https://example.com/source",
					publishedDate: "2026-09-01",
					highlights: ["Relevant evidence."],
				}],
				costDollars: { total: 0.007 },
			});
		}) as typeof fetch;

		const tool = registeredTools().get("exa_search");
		expect(tool).toBeDefined();
		const result = await tool!.execute("call-1", {
			query: "primary source",
			numResults: 3,
			includeDomains: ["example.com"],
		}, undefined, undefined);

		expect(request?.url).toBe("https://api.exa.ai/search");
		expect(request?.init.headers).toEqual({
			"content-type": "application/json",
			"x-api-key": "test-key",
		});
		expect(JSON.parse(String(request?.init.body))).toEqual({
			query: "primary source",
			numResults: 3,
			type: "auto",
			includeDomains: ["example.com"],
			contents: { highlights: true },
		});
		expect(result.content[0]?.text).toContain("Primary source");
		expect(result.content[0]?.text).toContain("https://example.com/source");
		expect(result.content[0]?.text).toContain("Relevant evidence.");
		expect(result.details).toEqual({ requestId: "request-1", resultCount: 1, costDollars: 0.007 });
	});

	test("retrieves page text with the Contents API and reports failed URLs", async () => {
		let body: Record<string, unknown> | undefined;
		globalThis.fetch = (async (_url, init) => {
			body = JSON.parse(String(init?.body));
			return response({
				results: [{ title: "Page", url: "https://example.com", text: "Page body" }],
				statuses: [
					{ id: "https://example.com", status: "success", source: "crawled" },
					{ id: "https://missing.example", status: "error", error: { tag: "CRAWL_NOT_FOUND" } },
				],
			});
		}) as typeof fetch;

		const tool = registeredTools().get("exa_contents");
		expect(tool).toBeDefined();
		const result = await tool!.execute("call-2", {
			urls: ["https://example.com", "https://missing.example"],
			verbosity: "standard",
			excludeSections: ["navigation", "footer"],
			maxAgeHours: 0,
		}, undefined, undefined);

		expect(body).toEqual({
			urls: ["https://example.com", "https://missing.example"],
			text: {
				maxCharacters: 10000,
				verbosity: "standard",
				excludeSections: ["navigation", "footer"],
			},
			maxAgeHours: 0,
		});
		expect(result.content[0]?.text).toContain("Page body");
		expect(result.content[0]?.text).toContain("https://missing.example: CRAWL_NOT_FOUND");
	});

	test("surfaces Exa API errors", async () => {
		globalThis.fetch = (async () => response({ error: "Invalid API key" }, 401)) as typeof fetch;
		const tool = registeredTools().get("exa_search")!;
		await expect(tool.execute("call-3", { query: "test" }, undefined, undefined))
			.rejects.toThrow("Exa search failed (401): Invalid API key");
	});
});
