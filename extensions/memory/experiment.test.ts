import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareCheckpoint, logAttempt, saveCapture, requestHash, type CheckpointCapture } from "./experiment.ts";

test("comparison is bounded, paired, order-balanced and preserves captured requests", async () => {
	const capture: CheckpointCapture = { version: 1, session: "s", leaf: "e", model: "test/model", trigger: "compact", register: "v11",
		options: { sessionId: "s", maxTokens: 2000 }, requests: [{ messages: [] }, { messages: [], systemPrompt: "impersonal" }] };
	const before = JSON.stringify(capture), variants: string[] = [];
	let calls = 0;
	await compareCheckpoint(capture, 2, async request => {
		calls++; request.messages.push({ role: "user", content: "mutation", timestamp: 0 });
		if (calls === 1) throw new Error("transport");
		return { stopReason: "stop" };
	}, (variant, round, request, started, response) => {
		variants.push(variant);
		if (calls === 1) expect(response.errorMessage).toContain("transport");
	});
	expect(calls).toBe(4);
	expect(variants[0]).toBe(variants[3]);
	expect(variants[1]).toBe(variants[2]);
	expect(variants[0]).not.toBe(variants[1]);
	expect(JSON.stringify(capture)).toBe(before);
	await expect(compareCheckpoint(capture, 6, async () => { throw new Error("must not call"); }, () => {})).rejects.toThrow("1–5");
});

test("private capture and attempt ledger include zero-output errors", () => {
	const dir = mkdtempSync(join(tmpdir(), "memory-experiment-"));
	try {
		const file = join(dir, "attempts.jsonl"), request = { messages: [] };
		logAttempt(file, { register: "v11", attempt: 1 }, request, Date.now(), { stopReason: "error", errorMessage: "blocked" });
		const record = JSON.parse(readFileSync(file, "utf8"));
		expect(record.requestHash).toBe(requestHash(request));
		expect(record.error).toBe("blocked");
		expect(record.ms).toBeGreaterThanOrEqual(0);
		expect(statSync(file).mode & 0o777).toBe(0o600);
		const captureFile = join(dir, "capture.json");
		const capture: CheckpointCapture = { version: 1, session: "s", leaf: null, model: "test/model", trigger: "compact", register: "v11", options: { sessionId: "s", maxTokens: 2000 }, requests: [request, request] };
		saveCapture(captureFile, capture);
		expect(JSON.parse(readFileSync(captureFile, "utf8"))).toEqual(capture);
		expect(statSync(captureFile).mode & 0o777).toBe(0o600);
	} finally { rmSync(dir, { recursive: true, force: true }); }
});
