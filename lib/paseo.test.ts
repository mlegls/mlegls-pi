import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Replay the documented native CLI boundary without creating daemon/global resources.
async function encounter(tasks: unknown[], options = {}, failure = "") {
  const dir = mkdtempSync(join(tmpdir(), "paseo-dispatch-"));
  const log = join(dir, "calls");
  const cli = join(dir, "paseo");
  writeFileSync(cli, "#!" + process.execPath + "\n" + [
    'import { appendFileSync, readFileSync } from "node:fs";',
    'const args = process.argv.slice(2);',
    'appendFileSync(process.env.CALLS, JSON.stringify(args) + "\\n");',
    'const n = readFileSync(process.env.CALLS, "utf8").trim().split("\\n").length;',
    'if ("json-" + n === process.env.FAIL_AT) { console.log("truncated receipt"); process.exit(0); }',
    'if (String(n) === process.env.FAIL_AT) { console.log("partial agent unknown"); process.exit(1); }',
    'console.log(JSON.stringify(args[0] === "workspace" ? {workspaceId: "ws-" + n, cwd: "/isolated/" + n, isolation: "worktree"} : {agentId: "agent-" + n, cwd: "/isolated/" + (n-1), provider: "pi", status: "created"}));',
  ].join("\n"), { mode: 0o700 });
  const script = join(dir, "encounter.ts");
  writeFileSync(script, 'import { dispatch } from ' + JSON.stringify(resolve(import.meta.dir, "dispatch.ts")) + ';\n' +
    'try { console.log(JSON.stringify(await dispatch(' + JSON.stringify(tasks) + ',' +
    JSON.stringify({ run: "trial", maxConcurrent: 2, active: [], ...options }) + '))); } catch (e) { console.log(JSON.stringify({error: String(e)})); }');
  try {
    const child = Bun.spawn([process.execPath, script], { env: { ...process.env,
      PASEO_AGENT_ID: "parent-1", PASEO_CLI: cli, PI_AGENTS_DIR: resolve(import.meta.dir, "../agents"), CALLS: log, FAIL_AT: failure }, stdout: "pipe", stderr: "pipe" });
    const output = await new Response(child.stdout).text();
    const err = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    if (!output.trim()) throw new Error(err);
    let calls: string[][] = [];
    try { calls = readFileSync(log, "utf8").trim().split("\n").map(s => JSON.parse(s)); } catch {}
    return { result: JSON.parse(output), calls };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const task = { handle: "a", prompt: "Exact task\nquotes ' \" $() --json", agent: "fill", model: "zai/glm-5.3-flash", effort: "high", base: "05ef261674a4e45f2c3d0cb4fa141f452fc46942" };

test("prepared assignment survives native workspace/run boundary; capacity stays parent-owned", async () => {
  const { result, calls } = await encounter([task, { ...task, handle: "b" }], { maxConcurrent: 1 });
  expect(result.submitted[0]).toMatchObject({ backend: "paseo", agentId: "agent-2", workspaceId: "ws-1", path: "/isolated/1" });
  expect(result.pending.map((t: any) => t.handle)).toEqual(["b"]);
  expect(calls[0]).toContain(task.base);
  expect(calls[1].slice(0, 12)).toEqual(["run", "--background", "--workspace", "ws-1", "--provider", "pi", "--model", task.model, "--thinking", "high", "--title", "trial/a"]);
  expect(calls[1].slice(12, 14)).toEqual(["--json", "--"]);
  const prompt = calls[1].at(-1)!;
  expect(prompt).toContain(task.prompt);
  expect(prompt).toContain("Parent agent ID: parent-1");
  expect(prompt).toContain("done, blocked, or needs-input");
  expect(prompt).toContain("You are "+ String.fromCharCode(96) + "fill" + String.fromCharCode(96));
});

test("uncertain creation stops wave and retains previous launch plus workspace and raw failure", async () => {
  const { result, calls } = await encounter([task, { ...task, handle: "b" }, { ...task, handle: "c" }], { maxConcurrent: 3 }, "4");
  expect(calls).toHaveLength(4);
  expect(result.submitted).toHaveLength(1);
  expect(result.failed.assignment.handle).toBe("b");
  expect(result.failed.receipt.workspace.workspaceId).toBe("ws-3");
  expect(result.failed.receipt.cause.stdout).toContain("partial agent unknown");
  expect(result.pending.map((t: any) => t.handle)).toEqual(["c"]);
  const first = await encounter([task, { ...task, handle: "b" }], {}, "1");
  expect(first.calls).toHaveLength(1);
  expect(first.result.failed.receipt.cause.stdout).toContain("partial agent unknown");
});

test("whole-wave validation and issue ownership happen before native effects", async () => {
  for (const tasks of [[task, task], [{ ...task, issue: "ticket", assignee: "human" }], [{ ...task, issue: "ticket" }]]) {
    const { result, calls } = await encounter(tasks);
    expect(result.error).toBeString();
    expect(calls).toEqual([]);
  }
  const { calls, result } = await encounter([task], { active: [{ backend: "paseo", handle: "busy" }], maxConcurrent: 1 });
  expect(calls).toEqual([]);
  expect(result.pending).toHaveLength(1);
});


test("Pi's none alias maps to its native off thinking ID", async () => {
  const { calls } = await encounter([{ ...task, effort: "none" }]);
  expect(calls[1][calls[1].indexOf("--thinking") + 1]).toBe("off");
});


test("a successful CLI exit with malformed JSON is still uncertain and never retried", async () => {
  const { result, calls } = await encounter([task, { ...task, handle: "b" }], {}, "json-2");
  expect(calls).toHaveLength(2);
  expect(result.submitted).toEqual([]);
  expect(result.failed.receipt.workspace.workspaceId).toBe("ws-1");
  expect(result.failed.receipt.cause.stdout).toContain("truncated receipt");
  expect(result.pending).toHaveLength(1);
});
