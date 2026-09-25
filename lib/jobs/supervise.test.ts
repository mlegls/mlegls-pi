import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";

// The loop's host boundary (children, dispatch launches, routing) is scripted; its git choreography —
// close commits riding child branches, serialized rebase/ff merges, branch retention on redispatch —
// runs for real against a throwaway checkout.
type End = { id: string; kind: "finished" | "error" | "closed" | "permission"; text: string; cursor: string };
const dir = import.meta.dir;
const childrenPath = join(dir, "../children.ts"), dispatchPath = join(dir, "../dispatch.ts"),
  routePath = join(dir, "../route.ts"), paseoPath = join(dir, "../paseo.ts");
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

let repo = "", serial = 0;
const wsPaths = new Map<string, string>();
const endsByAgent = new Map<string, End[]>();
const launchScript: { commit?: string[]; ends: { kind: End["kind"]; text: string }[] }[] = [];
const launched: string[] = [];
const sent: string[] = [];
let sendFailures = 0;

const real = {
  children: await import(childrenPath),
  dispatch: await import(dispatchPath),
  route: await import(routePath),
  paseo: await import(paseoPath),
};
mock.module(childrenPath, () => ({
  send: async (id: string, text: string) => {
    if (sendFailures > 0) { sendFailures--; throw new Error("Cannot replace agent " + id + " because its active run cancellation was not acknowledged"); }
    sent.push(text);
  },
  last: async (id: string) => {
    if (String(id).includes("dead")) throw new Error("Paseo timeline " + id + ": agent not found");
    return null;
  },
  turnEnd: (ids: string[], options: { after?: Record<string, string>; signal?: AbortSignal }) => {
    for (const id of ids) {
      const queue = endsByAgent.get(id), next = queue?.[0];
      if (next && next.cursor !== options.after?.[id]) { queue!.shift(); return Promise.resolve(next); }
    }
    return new Promise<never>((_, reject) => options.signal?.addEventListener("abort",
      () => reject(new Error("child wait aborted")), { once: true }));
  },
}));
mock.module(paseoPath, () => ({ ...real.paseo, archive: async (workspaceId: string) => {
  const path = wsPaths.get(workspaceId);
  if (path) rmSync(path, { recursive: true, force: true }); // the daemon removes the worktree; retire then prunes and settles the branch
  return {};
} }));
mock.module(routePath, () => ({ ...real.route, prepare: async () => ({ kind: "ready", agent: "agent", model: "test/model", effort: "low" }) }));
mock.module(dispatchPath, () => ({
  ...real.dispatch,
  dispatch: async (assignments: { handle: string; base?: string }[], options: { run: string }) => {
    const a = assignments[0];
    const branch = options.run + "/" + a.handle, wt = join(dirname(repo), basename(repo) + "-wt-" + a.handle + "-" + (++serial));
    git(repo, "worktree", "add", "-b", branch, wt, a.base ?? "HEAD");
    const step = launchScript.shift();
    for (const f of step?.commit ?? []) { writeFileSync(join(wt, f), f + "\n"); git(wt, "add", "-A"); git(wt, "commit", "-qm", "work " + f); }
    const agentId = "agent-" + a.handle + "-" + serial;
    endsByAgent.set(agentId, (step?.ends ?? []).map((end, i) => ({ ...end, id: agentId, cursor: agentId + ":" + i })));
    wsPaths.set("ws-" + agentId, wt);
    launched.push(branch);
    return { submitted: [{ backend: "paseo", handle: a.handle, agentId, workspaceId: "ws-" + agentId, path: wt, receipt: {} }], pending: [] };
  },
}));

const supervise = await import(join(dir, "supervise.ts"));

const staged = (slug: string, parent?: string) =>
  "---\nstage: ticket\nassignee: agent\n" + (parent ? 'part-of: "[[projects/test/issues/' + parent + ']]"\n' : "") + "---\n\nTiny ticket " + slug + ": add " + slug + ".txt and commit it.\n";
const unstaged = (slug: string, parent?: string) =>
  "---\nassignee: agent\n" + (parent ? 'part-of: "[[projects/test/issues/' + parent + ']]"\n' : "") + "---\n\nTiny ticket " + slug + ": add " + slug + ".txt and commit it.\n";
const handoff = (stories: unknown, caveats: unknown[] = []) =>
  "done\n\n```yaml\ncommit: \"x\"\nsetup: try it\nstories: " + JSON.stringify(stories) + "\ncaveats: " + JSON.stringify(caveats) + "\n```\n";
const held = { story: "s", status: "held" }, unobservable = { story: "s", status: "unobservable" };

beforeAll(() => {
  repo = join(mkdtempSync(join(realpathSync(tmpdir()), "ab-supervise-test-")), "repo");
  mkdirSync(join(repo, "docs/issues"), { recursive: true });
  writeFileSync(join(repo, "docs/issues/.keep"), "");
  const files: Record<string, string> = {
    "use-loops-a": staged("use-loops-a"), "leaf-a": staged("leaf-a", "use-loops-a"),
    "use-loops-b": staged("use-loops-b"), "leaf-b": staged("leaf-b", "use-loops-b"),
    // A child supervisor whose own leaf stays open: its loop ends via the idle wake, not finished.
    "use-sup": staged("use-sup"), "sub-sup": staged("sub-sup", "use-sup"), "leaf-sup": staged("leaf-sup", "sub-sup"),
    // A parent that delegates all its work may omit stage (tracker: omitted stage requires children).
    "use-close": staged("use-close"), "sub-close": unstaged("sub-close", "use-close"), "leaf-close": staged("leaf-close", "sub-close"),
    "use-obs": staged("use-obs"), "leaf-obs": staged("leaf-obs", "use-obs"),
    "use-rd": staged("use-rd"), "leaf-rd": staged("leaf-rd", "use-rd"),
    "use-rd2": staged("use-rd2"), "leaf-rd2": staged("leaf-rd2", "use-rd2"),
  };
  for (const [slug, text] of Object.entries(files)) writeFileSync(join(repo, "docs/issues", slug + ".md"), text);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@test");
  git(repo, "config", "user.name", "test");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "tickets");
});

afterAll(() => {
  mock.module(childrenPath, () => real.children);
  mock.module(paseoPath, () => real.paseo);
  mock.module(routePath, () => real.route);
  mock.module(dispatchPath, () => real.dispatch);
  if (repo) rmSync(dirname(repo), { recursive: true, force: true });
});

let jobs = 0;
const start = (ticketSlug: string, carried?: unknown) => {
  const controller = new AbortController();
  const ctx: Record<string, unknown> = {
    id: "job-" + ++jobs,
    input: { ticket: ticketSlug, cwd: repo, owner: "owner-unused", budget: 2, commands: join(repo, ".commands-" + jobs + ".jsonl"), carried: carried ?? null },
    state: null, saved: null as Record<string, any> | null,
    save(state: unknown) { ctx.state = state; ctx.saved = JSON.parse(JSON.stringify(state)); },
    log() { },
    signal: controller.signal,
  };
  return { ctx, controller, done: supervise.run(ctx as never), get state() { return ctx.saved as Record<string, any> | null; } };
};
type Running = ReturnType<typeof start>;
const until = async (run: Running, probe: (state: Record<string, any>) => boolean) => {
  for (let i = 0; i < 600; i++) {
    if (run.state && probe(run.state)) return;
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error("timed out waiting on job state: " + JSON.stringify(run.state));
};
const command = (run: Running, line: unknown) => appendFileSync((run.ctx.input as any).commands, JSON.stringify(line) + "\n");
const script = (steps: { commit?: string[]; ends: { kind: End["kind"]; text: string }[] }[]) => launchScript.push(...steps);
const doneHeld = { kind: "finished" as const, text: handoff([held]) };

describe("supervise loop", () => {
  test("two loops on one checkout integrate at the same moment; both close, with a busy owner", async () => {
    sendFailures = 1; // first wake attempt hits a busy owner; the retry delivers
    script([{ ends: [doneHeld] }, { ends: [doneHeld] }, { ends: [doneHeld] }, { ends: [doneHeld] }]); // 2 jobs × implement + verify
    const a = start("use-loops-a"), b = start("use-loops-b");
    await Promise.all([a.done, b.done]);
    expect((a.state as any).finished, JSON.stringify(a.state)).toBe(true);
    expect((b.state as any).finished).toBe(true);
    for (const file of ["leaf-a", "leaf-b"]) expect(git(repo, "show", "HEAD:docs/issues/" + file + ".md")).toContain("stage: done");
    expect(git(repo, "log", "--oneline")).toContain("Close leaf-a");
    expect(git(repo, "log", "--oneline")).toContain("Close leaf-b");
    expect(sent.filter(t => t.includes("done:"))).toHaveLength(2);
    expect((a.state as any).pending).toBeUndefined();
  }, 120_000);

  test("a child supervisor's closed check-in does not wake the owner", async () => {
    script([{ ends: [{ kind: "closed", text: "still waiting on my own loop" }, { kind: "finished", text: handoff([{ story: "subtree", status: "held" }]) }] }]);
    sent.length = 0;
    const run = start("use-sup");
    await run.done;
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain("idle: nothing live, but not done: sub-sup");
    expect(git(repo, "show", "HEAD:docs/issues/sub-sup.md")).toContain("stage: done");
  }, 120_000);

  test("close inserts stage: done into a frontmatter that omits it", async () => {
    sendFailures = 99; // owner never accepts: the idle wake must land in the queue, not the job's face
    sent.length = 0;
    script([{ ends: [{ kind: "finished", text: handoff([{ story: "subtree", status: "held" }]) }] }]);
    const run = start("use-close");
    try { await run.done; } finally { sendFailures = 0; }
    const merged = git(repo, "show", "HEAD:docs/issues/sub-close.md");
    expect(/^---\n[\s\S]*?\n---/.exec(merged)?.[0]).toContain("stage: done");
    expect(merged.indexOf("stage: done")).toBeLessThan(merged.indexOf("---", 4));
    expect((run.state as any).pending).toHaveLength(1);
    expect((run.state as any).pending[0]).toContain("idle: nothing live, but not done: sub-close");
    expect(sent).toHaveLength(0);
    sendFailures = 0;
  }, 120_000);

  test("an implement handoff whose stories are all unobservable is an exception, like caveats", async () => {
    sendFailures = 0;
    script([{ ends: [{ kind: "finished", text: handoff([unobservable]) }] }]);
    sent.length = 0;
    const run = start("use-obs");
    await until(run, state => !!state.children["leaf-obs"]?.waiting);
    run.controller.abort();
    await run.done;
    expect(sent.some(t => t.includes("done with nothing observable"))).toBe(true);
    expect(launched.filter(b => b.startsWith("use-obs/"))).toHaveLength(1); // no verifier launched
  }, 120_000);

  test("redispatch deletes an empty branch and relaunches under the same name", async () => {
    script([
      { ends: [{ kind: "error", text: "gave up" }] }, // first implement dies; owner orders a redispatch
      { ends: [doneHeld] }, { ends: [doneHeld] }, // relaunch implements, then its verifier holds
    ]);
    sent.length = 0;
    const run = start("use-rd");
    await until(run, state => !!state.children["leaf-rd"]?.waiting);
    command(run, { child: "leaf-rd", action: "redispatch" });
    await run.done;
    expect((run.state as any).finished).toBe(true);
    expect(launched.filter(b => b.startsWith("use-rd/"))).toEqual(["use-rd/leaf-rd", "use-rd/leaf-rd", "use-rd/leaf-rd-verify"]);
    expect(git(repo, "show", "HEAD:docs/issues/leaf-rd.md")).toContain("stage: done");
  }, 120_000);

  test("redispatch keeps a branch with work and relaunches under a distinct handle", async () => {
    script([
      { commit: ["leaf-rd2.txt"], ends: [{ kind: "error", text: "gave up with work done" }] },
      { ends: [doneHeld] }, { ends: [doneHeld] },
    ]);
    const run = start("use-rd2");
    await until(run, state => !!state.children["leaf-rd2"]?.waiting);
    command(run, { child: "leaf-rd2", action: "redispatch" });
    await run.done;
    expect((run.state as any).finished).toBe(true);
    expect(launched.filter(b => b.startsWith("use-rd2/"))).toEqual(["use-rd2/leaf-rd2", "use-rd2/leaf-rd2-2", "use-rd2/leaf-rd2-verify"]);
    expect(git(repo, "rev-parse", "--verify", "-q", "refs/heads/use-rd2/leaf-rd2")).toHaveLength(40); // kept for inspection
  }, 120_000);
});
