// Bounded transport audit. Run: bun docs/research/transport-recovery/probe.ts
// Real loop/board code; fake tracker, transport failures and host lifecycle. No live workers.
import { expect, mock } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const source = resolve(import.meta.dir, "../../..");
const mode = process.argv[2];
if (!mode) {
  const root = mkdtempSync(join(tmpdir(), "transport-recovery-"));
  try {
    for (const scenario of ["board", "loop"]) {
      const child = Bun.spawn([process.execPath, import.meta.path, scenario], {
        env: { ...process.env, HOME: root, PI_BOARD_DIR: join(root, "board"), TMUX_PANE: "", PI_BOARD_TOPIC: "" },
        stdout: "inherit", stderr: "inherit",
      });
      expect(await child.exited).toBe(0);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
} else if (mode === "board") {
  const { install } = await import(join(source, "lib/board/host.ts"));
  const { send } = await import(join(source, "lib/children.ts"));
  const { readAll } = await import(join(source, "lib/board/store.ts"));
  const entries: any[] = [], delivered: any[] = [], handlers = new Map();
  let idle = false, poll!: () => void;
  mock.module(join(source, "lib/board/scopes.ts"), () => ({ scopes: () => [] }));
  const interval = globalThis.setInterval;
  globalThis.setInterval = ((fn: () => void) => { poll = fn; return { unref() {} }; }) as any;
  try {
    install({
      events: { on() {} }, on: (name: string, fn: unknown) => handlers.set(name, fn),
      appendEntry: (customType: string, data: unknown) => entries.push({ type: "custom", customType, data: structuredClone(data) }),
      sendMessage: (message: unknown, options: unknown) => delivered.push({ message, options }),
      registerCommand() {}, registerMessageRenderer() {},
    } as any);
    const context = { cwd: process.env.HOME, hasUI: false, isIdle: () => idle,
      sessionManager: { getSessionId: () => "audit-owner-12345678", getBranch: () => entries } };
    handlers.get("session_start")({}, context);
    await send("mail/12345678", "first");
    await send("mail/12345678", "second");
    poll();
    expect(readAll().map((m: any) => m.body)).toEqual(["first", "second"]);
    expect(delivered).toHaveLength(0);
    // Restore from persisted busy-session state before allowing delivery.
    handlers.get("session_tree")({}, context);
    idle = true; poll(); poll();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].message.details.messages.map((m: any) => m.body)).toEqual(["first", "second"]);
    expect(delivered[0].options).toEqual({ triggerTurn: true, deliverAs: "followUp" });
    handlers.get("session_tree")({}, context); poll();
    expect(delivered).toHaveLength(1);
    console.log("board: busy owner queues two real mailbox writes; restored state delivers once in order when idle");
  } finally { globalThis.setInterval = interval; }
} else if (mode === "loop") {
  const root = process.env.HOME!, cwd = join(root, "repo");
  const tracker = join(root, ".pi/agent/skills/tracker/scripts");
  mkdirSync(tracker, { recursive: true }); mkdirSync(cwd);
  writeFileSync(join(tracker, "issues.ts"), 'console.log(JSON.stringify({issues:[]}));');
  execFileSync("git", ["init", "-q", cwd]);
  execFileSync("git", ["-C", cwd, "-c", "user.name=Audit", "-c", "user.email=audit@example.invalid", "commit", "--allow-empty", "-qm", "Fixture"]);
  const commands = join(root, "commands"); writeFileSync(commands, "");
  const control = new AbortController(), logs: string[] = [], deliveries: string[] = [];
  let watches = 0, sends = 0, saved: any;
  mock.module(join(source, "lib/children.ts"), () => ({
    turnEnd: async (ids: string[], options: any) => {
      expect(options.cwd).toBe(cwd);
      if (++watches === 1) throw new Error("injected watch disconnect");
      if (watches === 2) return { id: ids[0], kind: "finished", cursor: "report-1", text: "blocked\nfixture needs owner" };
      expect(options.after[ids[0]]).toBe("report-1");
      return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    },
    send: async (_owner: string, text: string) => {
      if (++sends === 1) throw new Error("injected mailbox write failure");
      deliveries.push(text); control.abort();
    }, last: async () => null,
  }));
  const { run } = await import(join(source, "lib/jobs/supervise.ts"));
  const state = { children: { worker: { slug: "worker", phase: "implement", handle: { run: "audit", handle: "worker", path: cwd } } },
    integrated: [], metrics: { wakes: 0, ownerBytes: 0, launched: 0, completed: 0 } };
  const deadline = setTimeout(() => control.abort(new Error("probe timeout")), 15000);
  try {
    await run({ id: "audit", input: { ticket: "audit", cwd, owner: "mail/12345678", ownerSession: "audit-owner", budget: 1, commands },
      state, signal: control.signal, save: async (s: unknown) => { saved = structuredClone(s); }, log: (s: string) => logs.push(s) });
    expect(watches).toBe(3); expect(sends).toBe(2); expect(deliveries).toHaveLength(1);
    expect(saved.children.worker.waiting).toBe("blocked"); expect(saved.children.worker.cursor).toBe("report-1");
    expect(saved.integrated).toEqual([]); expect(saved.metrics.launched).toBe(0);
    expect(logs.some(s => s.includes("watch failed (1)"))).toBe(true);
    expect(logs.some(s => s.includes("wake deferred (1)"))).toBe(true);
    console.log("loop: failed watch retries; failed notification retries while next watch proceeds; child/cursor retained, no redispatch");
  } finally { clearTimeout(deadline); }
} else throw new Error("Unknown probe mode");
