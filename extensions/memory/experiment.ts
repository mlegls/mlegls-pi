import { createHash } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import type { Context } from "@earendil-works/pi-ai";

export interface CheckpointCapture {
	version: 1;
	session: string;
	leaf: string | null;
	model: string;
	trigger: "hibernate" | "compact";
	register: string;
	options: { sessionId: string; reasoning?: string; maxTokens: number };
	requests: [Context, Context];
}
export const requestHash = (request: Context) => createHash("sha256").update(JSON.stringify(request)).digest("hex");
export function saveCapture(file: string, capture: CheckpointCapture) {
	writeFileSync(file, JSON.stringify(capture), { mode: 0o600 });
}
export function logAttempt(file: string, metadata: Record<string, unknown>, request: Context, started: number, response: any) {
	appendFileSync(file, JSON.stringify({ ...metadata, timestamp: new Date().toISOString(), requestHash: requestHash(request),
		ms: Date.now() - started, stopReason: response.stopReason, error: response.errorMessage, usage: response.usage }) + "\n", { mode: 0o600 });
}

/** Paired, order-balanced replay. No session mutation and no execution of returned tools. */
export async function compareCheckpoint(capture: CheckpointCapture, rounds: number,
	call: (request: Context, options: CheckpointCapture["options"]) => Promise<any>,
	record: (variant: string, round: number, request: Context, started: number, response: any) => void) {
	if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) throw new Error("Use 1–5 rounds (2 calls per round)");
	const first = Math.random() < 0.5 ? 0 : 1;
	for (let round = 0; round < rounds; round++) {
		const order = (first + round) % 2 ? [1, 0] : [0, 1];
		for (const i of order) {
			const request = structuredClone(capture.requests[i]), started = Date.now();
			let response;
			try { response = await call(request, capture.options); }
			catch (error) { response = { stopReason: "error", errorMessage: String(error) }; }
			record(i ? "impersonal" : "unchanged", round + 1, request, started, response);
		}
	}
}
