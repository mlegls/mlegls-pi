import { test, expect } from "bun:test";
import orcaExtension from "../extensions/orca/index.ts";
import boardExtension from "./board/host.ts";
import { run as read } from "./autoread.ts";
import { executionHost } from "./execution-host.ts";

async function withEnv(env: Record<string, string>, fn: () => unknown) {
  const keys = ["PASEO_AGENT_ID", "ORCA_WORKTREE_ID", "ORCA_WORKSPACE_ID", "PI_SESSION_FILE"];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    for (const k of keys) { delete process.env[k]; }
    Object.assign(process.env, env);
    await fn();
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test("native host substitution leaves no Orca hooks in Paseo or standalone", async () => {
  // Any registration (commands, status timers, turn hooks) would touch this proxy.
  const untouched = new Proxy({} as any, { get() { throw new Error("unexpected host hook"); } });
  await withEnv({}, () => { expect(executionHost()).toBe("wm"); orcaExtension(untouched); });
  await withEnv({ PASEO_AGENT_ID: "p", ORCA_WORKTREE_ID: "inherited" }, () => {
    expect(executionHost()).toBe("paseo");
    orcaExtension(untouched);
    boardExtension(untouched);
  });
  await withEnv({ ORCA_WORKSPACE_ID: "w" }, () => { expect(executionHost()).toBe("orca"); boardExtension(untouched); });
});

test("Paseo and standalone readers select the local persisted-session boundary", async () => {
  for (const env of [{}, { PASEO_AGENT_ID: "p", ORCA_WORKTREE_ID: "inherited" }] as Record<string, string>[]) {
    await withEnv(env, async () => {
      await expect(read("Read only", { model: "zai/glm-5.3-flash", effort: "high", memoryExtension: false }))
        .rejects.toThrow("sessionFile required");
    });
  }
});
