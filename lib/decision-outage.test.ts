import { expect, test } from "bun:test";
import { decide } from "./decide.ts";

const question = { safe: { type: "noul" as const, instructions: "Can supervision continue?" } };
const answer = { model: "fixture", answers: { safe: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 1, output_tokens: 1 } };

// Replays first-use checks 1–2: a classified result after 503/network failures,
// a bounded persistent 503 and a single-attempt 402 at the public decision surface.
test("Decision API retries transient failures but reports persistent outages", async () => {
 for (const [failure, count, expected] of [[503, 1, 2], [503, 20, 4], [402, 20, 1]] as const) {
  let attempts = 0;
  const at: number[] = [];
  const server = Bun.serve({ port: 0, fetch() {
   attempts++; at.push(Date.now());
   if (attempts <= count) {
    return new Response("synthetic outage", { status: failure });
   }
   return Response.json(answer);
  } });
  try {
   const call = decide("Supervise this ticket", question, { apiKey: "fixture", url: server.url.toString() });
   if (count === 20) await expect(call).rejects.toThrow(`Decision API unavailable: HTTP ${failure} after ${failure === 402 ? "one attempt" : "4 attempts"}`);
   else expect((await call).safe.choice).toBe("true");
   expect(attempts).toBe(expected);
   if (failure === 503 && count === 1) expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(200);
   if (failure === 503 && count === 20) expect(at[3]! - at[2]!).toBeGreaterThanOrEqual(900);
  } finally { server.stop(true); }
 }
 // First-use check 1's connection reset: a fetch TypeError is retried before classification.
 const original = globalThis.fetch;
 let attempts = 0;
 globalThis.fetch = Object.assign(async (...args: Parameters<typeof fetch>) => {
  if (++attempts < 3) throw new TypeError("synthetic connection reset");
  return original(...args);
 }, { preconnect: original.preconnect });
 const server = Bun.serve({ port: 0, fetch: () => Response.json(answer) });
 try {
  expect((await decide("Supervise this ticket", question, { apiKey: "fixture", url: server.url.toString() })).safe.choice).toBe("true");
  expect(attempts).toBe(3);
  attempts = 0;
  globalThis.fetch = Object.assign(async () => { attempts++; throw new TypeError("synthetic connection reset"); }, { preconnect: original.preconnect });
  await expect(decide("Supervise this ticket", question, { apiKey: "fixture", url: server.url.toString() })).rejects.toThrow("Decision API unavailable: network failure after 4 attempts");
  expect(attempts).toBe(4);
 } finally { globalThis.fetch = original; server.stop(true); }
}, 12_000);
