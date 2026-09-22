import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Replay the public SDK boundary in isolated processes; never touch the live daemon.
async function encounter(tasks: unknown[], options = {}, failure = "", operation = "dispatch") {
  const dir = mkdtempSync(join(tmpdir(), "paseo-dispatch-"));
  const log = join(dir, "calls");
  const script = join(dir, "encounter.ts");
  writeFileSync(script, [
    'import { mock } from "bun:test";',
    'import { appendFileSync } from "node:fs";',
    'const record = (op, input) => appendFileSync(process.env.CALLS, JSON.stringify({op,input}) + String.fromCharCode(10));',
    'let n = 0; const step = (op, input) => { record(op,input); n++; if (String(n) === process.env.FAIL_AT) throw new Error("connection lost; outcome unknown"); return n; };',
    'mock.module(' + JSON.stringify(import.meta.resolve("@getpaseo/client")) + ', () => ({ createPaseoClient(config) { record("config", config); return {',
    'connect: async () => { record("connect"); if (process.env.FAIL_AT === "connect") throw new Error("connection refused"); },',
    'close: async () => { record("close"); if (process.env.FAIL_AT === "close") throw new Error("close failed"); },',
    'workspaces: { create: async input => { const k = step("workspace", input); const snapshot = { id: "ws-"+k, workspaceDirectory: "/isolated/"+k, workspaceKind: "worktree" }; return {',
    'id: snapshot.id, directory: snapshot.workspaceDirectory, current: () => snapshot, agents: {create: async input => {const j = step("agent", input); const a = { id: "agent-"+j, cwd: snapshot.workspaceDirectory, provider: "pi", status: process.env.FAIL_AT === "bad-"+j ? "error" : "idle" }; return {...a, current: () => a};}}}; },',
    'archive: async id => {step("archive",id); return {workspaceId:id, requestId:"archive-1", archivedAt:process.env.FAIL_AT === "archive" ? null : "2026-09-22", error:process.env.FAIL_AT === "archive" ? "workspace busy" : null};} },',
    '}; } }));',
    'const { dispatch } = await import(' + JSON.stringify(resolve(import.meta.dir, "dispatch.ts")) + ');',
    'const paseo = await import(' + JSON.stringify(resolve(import.meta.dir, "paseo.ts")) + ');',
    'try { console.log(JSON.stringify(' + (operation === "archive" ? 'await paseo.archive("ws-exact")' : 'await dispatch(' + JSON.stringify(tasks) + ',' + JSON.stringify({ run: "trial", maxConcurrent: 2, active: [], ...options }) + ')') + ')); } catch (e) { console.log(JSON.stringify({error: String(e), receipt:e.receipt})); }',
  ].join(String.fromCharCode(10)));
  try {
    const child = Bun.spawn([process.execPath, script], { env: { ...process.env,
      PASEO_AGENT_ID: "parent-1", PASEO_URL: "ws://fixture.invalid/ws", PASEO_PASSWORD: "fixture-password",
      PI_AGENTS_DIR: resolve(import.meta.dir, "../agents"), CALLS: log, FAIL_AT: failure }, stdout: "pipe", stderr: "pipe" });
    const output = await new Response(child.stdout).text();
    const err = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    if (!output.trim()) throw new Error(err);
    let events: {op: string; input: any}[] = [];
    try { events = readFileSync(log, "utf8").trim().split(String.fromCharCode(10)).map(s => JSON.parse(s)); } catch {}
    return { result: JSON.parse(output), events, calls: events.filter(e => ["workspace", "agent", "archive"].includes(e.op)).map(e => e.input) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const task = { handle: "a", prompt: "Exact task\nquotes ' \" $() --json", agent: "fill", model: "zai/glm-5.3-flash", effort: "high", base: "05ef261674a4e45f2c3d0cb4fa141f452fc46942" };

test("prepared assignment survives SDK workspace/agent boundary; capacity stays parent-owned", async () => {
  const { result, calls, events } = await encounter([task, { ...task, handle: "b" }], { maxConcurrent: 1 });
  expect(result.submitted[0]).toMatchObject({ backend: "paseo", agentId: "agent-2", workspaceId: "ws-1", path: "/isolated/1" });
  expect(result.pending.map((t: any) => t.handle)).toEqual(["b"]);
  expect(calls[0].source).toMatchObject({ kind: "worktree", action: "branch-off", branchName: "trial/a", baseBranch: task.base });
  expect(calls[1]).toMatchObject({ config: {provider: "pi/" + task.model, thinkingOptionId: "high"}, parent: "parent-1", title: "trial/a" });
  expect(calls[0].requestId).not.toBe(calls[1].requestId);
  expect(calls[1].prompt).toContain(task.prompt);
  expect(calls[1].prompt).toContain("Parent agent ID: parent-1");
  expect(calls[1].prompt).toContain("done, blocked, or needs-input");
  expect(calls[1].prompt).toContain("You are " + String.fromCharCode(96) + "fill" + String.fromCharCode(96));
  expect(events[0].input).toMatchObject({url: "ws://fixture.invalid/ws", password: "fixture-password", reconnect: {enabled:false}});
  expect(events.at(-1)?.op).toBe("close");
});

test("uncertain creation stops wave and retains previous launch, workspace, and request correlation", async () => {
  const { result, calls, events } = await encounter([task, { ...task, handle: "b" }, { ...task, handle: "c" }], { maxConcurrent: 3 }, "4");
  expect(calls).toHaveLength(4);
  expect(result.submitted).toHaveLength(1);
  expect(result.failed.assignment.handle).toBe("b");
  expect(result.failed.receipt.workspace.workspaceId).toBe("ws-3");
  expect(result.failed.receipt.cause).toContain("outcome unknown");
  expect(result.failed.receipt.requests.agent).toBe(calls[3].requestId);
  expect(result.pending.map((t: any) => t.handle)).toEqual(["c"]);
  expect(events.filter(e => e.op === "close")).toHaveLength(2);
  const first = await encounter([task, { ...task, handle: "b" }], {}, "1");
  expect(first.calls).toHaveLength(1);
  expect(first.result.failed.receipt.requests.workspace).toBe(first.calls[0].requestId);
});

test("whole-wave validation and issue ownership happen before connections or native effects", async () => {
  for (const tasks of [[task, task], [{ ...task, issue: "ticket", assignee: "human" }], [{ ...task, issue: "ticket" }]]) {
    const { result, events } = await encounter(tasks);
    expect(result.error).toBeString();
    expect(events).toEqual([]);
  }
  const { events, result } = await encounter([task], { active: [{ backend: "paseo", handle: "busy" }], maxConcurrent: 1 });
  expect(events).toEqual([]);
  expect(result.pending).toHaveLength(1);
});

test("Pi thinking alias and absent exact base pass through without inventing a default", async () => {
  const { calls } = await encounter([{ ...task, effort: "none", base: undefined }]);
  expect(calls[1].config.thinkingOptionId).toBe("off");
  expect(calls[0].source).not.toHaveProperty("baseBranch");
});

test("failed connection, failed agent, or failed close never permits a blind retry", async () => {
  for (const failure of ["connect", "bad-2", "close"]) {
    const { result, calls, events } = await encounter([task, { ...task, handle: "b" }], {}, failure);
    expect(result.submitted).toEqual([]);
    expect(result.pending).toHaveLength(1);
    expect(events.at(-1)?.op).toBe("close");
    expect(calls).toHaveLength(failure === "connect" ? 0 : 2);
    if (failure !== "connect") expect(result.failed.receipt.agent.agentId).toBe("agent-2");
  }
});

test("SDK archive error data is not reported as successful cleanup", async () => {
  const ok = await encounter([], {}, "", "archive");
  expect(ok.result).toMatchObject({workspaceId:"ws-exact", error:null});
  const failed = await encounter([], {}, "archive", "archive");
  expect(failed.result.receipt.error).toBe("workspace busy");
  expect(failed.calls).toEqual(["ws-exact"]);
  expect(failed.events.at(-1)?.op).toBe("close");
});
