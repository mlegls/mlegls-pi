import { test, expect } from "bun:test";
import boardExtension from "./board/host.ts";
import { executionHost } from "./execution-host.ts";

async function withEnv(env: Record<string, string>, fn: () => unknown) {
  const keys = ["PASEO_AGENT_ID", "PI_EXECUTION_HOST", "PI_SESSION_FILE"];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) { delete process.env[k]; }
    Object.assign(process.env, env);
    await fn();
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test("PI_EXECUTION_HOST chooses the host; otherwise Paseo inside a Paseo agent, else wm", () => {
  expect(executionHost({})).toBe("wm");
  expect(executionHost({ PASEO_AGENT_ID: "p" })).toBe("paseo");
  expect(executionHost({ PI_EXECUTION_HOST: "paseo" })).toBe("paseo");
  expect(executionHost({ PI_EXECUTION_HOST: "wm", PASEO_AGENT_ID: "p" })).toBe("wm");
  expect(executionHost({ PI_EXECUTION_HOST: "bogus" })).toBe("wm");
});

test("board registers no hooks when Paseo is the host", async () => {
  // Any registration (commands, status timers, turn hooks) would touch this proxy.
  const untouched = new Proxy({} as any, { get() { throw new Error("unexpected host hook"); } });
  await withEnv({ PASEO_AGENT_ID: "p" }, () => boardExtension(untouched));
  await withEnv({ PI_EXECUTION_HOST: "paseo" }, () => boardExtension(untouched));
});
