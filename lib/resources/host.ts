// Ephemeral executions owned by the existing ab daemon, never resumed after restart.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";

export interface Submission {
  kind: "check" | "service";
  command: string[];
  cwd: string;
  env: Record<string, string>;
  share?: string;
  revision?: string;
  ttl: number;
}
export interface Execution {
  id: string; kind: Submission["kind"]; command: string[]; cwd: string;
  status: "queued" | "running" | "done";
  log: string; submitted: number; started?: number; ended?: number;
  code?: number; reason?: string;
  expires?: number;
  revision?: string;
}
interface Entry {
  view: Execution; input: Submission; key?: string; child?: ChildProcess;
  clients: Map<string, number>; stopping?: boolean; killTimer?: ReturnType<typeof setTimeout>;
}

export class Resources {
  private entries = new Map<string, Entry>();
  private timer: ReturnType<typeof setInterval>;
  private closed = false;
  constructor(private root: string, private slots = 2) {
    if (!Number.isInteger(slots) || slots < 1) throw new Error("positive resource slots required");
    mkdirSync(root, { recursive: true, mode: 0o700 });
    this.timer = setInterval(() => this.sweep(), 1000);
    this.timer.unref();
  }
  submit(input: Submission) {
    if (this.closed) throw new Error("resources shutting down");
    if (!["check", "service"].includes(input.kind) || !Array.isArray(input.command) ||
        !input.command.length || input.command.some(x => typeof x !== "string" || x.includes("\0")) ||
        typeof input.cwd !== "string" || !input.cwd.startsWith("/") ||
        !input.env || Object.values(input.env).some(x => typeof x !== "string") ||
        !Number.isFinite(input.ttl) || input.ttl < 1 || input.ttl > 86400 ||
        (input.share !== undefined && typeof input.share !== "string") ||
        (input.revision !== undefined && !/^[0-9a-f]{40,64}$/.test(input.revision))) throw new Error("invalid resource submission");
    // share is an explicit input identity supplied by the caller, not a result-cache key.
    const key = input.kind === "check" && input.share ? createHash("sha256")
      .update(JSON.stringify([input.cwd, input.command, input.share, input.revision, input.ttl])).digest("hex") : undefined;
    let entry = key ? [...this.entries.values()].find(e => e.key === key && e.view.status !== "done" && !e.stopping) : undefined;
    if (!entry) {
      const id = randomUUID();
      entry = { input, key, clients: new Map(), view: { id, kind: input.kind, command: input.command,
        cwd: input.cwd, revision: input.revision, status: "queued", log: join(this.root, id + ".log"), submitted: Date.now() } };
      this.entries.set(id, entry);
    }
    const client = randomUUID();
    entry.clients.set(client, Date.now());
    this.drain();
    return { execution: { ...entry.view }, client };
  }
  list() { return [...this.entries.values()].map(e => ({ ...e.view })); }
  get(id: string, client?: string) {
    const entry = this.entry(id);
    if (client && entry.view.status !== "done") {
      if (!entry.clients.has(client)) throw new Error("unknown resource client");
      entry.clients.set(client, Date.now());
    }
    return { ...entry.view };
  }
  release(id: string, client: string) {
    const entry = this.entry(id);
    entry.clients.delete(client);
    if (entry.view.kind === "check" && !entry.clients.size) this.stopEntry(entry, "no waiting callers");
  }
  stop(id: string) { this.stopEntry(this.entry(id), "stopped"); }
  close() {
    this.closed = true;
    clearInterval(this.timer);
    // Synchronous for the daemon's exit hook, including children of completed shell leaders.
    for (const entry of this.entries.values()) if (entry.view.status !== "done") {
      this.signal(entry, "SIGKILL");
      this.finish(entry, 137, "daemon shutdown");
    }
  }
  private entry(id: string) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("unknown execution: " + id + " (daemon may have restarted)");
    return entry;
  }
  private signal(entry: Entry, signal: NodeJS.Signals) {
    if (entry.child?.pid) try { process.kill(-entry.child.pid, signal); } catch {}
  }
  private stopEntry(entry: Entry, reason: string) {
    if (entry.view.status === "done" || entry.stopping) return;
    entry.stopping = true;
    entry.view.reason = reason;
    if (!entry.child) { this.finish(entry, 130, reason); return; }
    this.signal(entry, "SIGTERM");
    entry.killTimer = setTimeout(() => this.signal(entry, "SIGKILL"), 1000);
    entry.killTimer.unref();
  }
  private assertRevision(entry: Entry) {
    if (!entry.input.revision) return;
    const git = (...args: string[]) => execFileSync("git", args, { cwd: entry.input.cwd, encoding: "utf8", timeout: 5000 }).trim();
    if (git("rev-parse", "HEAD") !== entry.input.revision || git("status", "--porcelain", "--untracked-files=all"))
      throw new Error("shared check inputs changed; rerun without --share");
  }
  private finish(entry: Entry, code: number, reason?: string) {
    if (entry.view.status === "done") return;
    clearTimeout(entry.killTimer);
    // A shell exiting doesn't mean its background descendants exited. No detached survivors.
    this.signal(entry, "SIGKILL");
    if (entry.view.started && !entry.stopping && !this.closed) {
      try { this.assertRevision(entry); }
      catch (error) { code = 1; reason = String(error); }
    }
    Object.assign(entry.view, { status: "done", code, ended: Date.now(), reason: entry.view.reason ?? reason });
    entry.input.env = {}; // don't retain credentials after execution
    this.drain();
  }
  private drain() {
    if (this.closed) return;
    let running = [...this.entries.values()].filter(e => e.view.kind === "check" && e.view.status === "running").length;
    for (const entry of this.entries.values()) {
      if (entry.view.status !== "queued") continue;
      if (entry.view.kind === "check" && running >= this.slots) continue;
      if (entry.view.kind === "check") running++;
      entry.view.status = "running";
      entry.view.started = Date.now();
      entry.view.expires = entry.view.started + entry.input.ttl * 1000;
      let fd: number | undefined;
      try {
        this.assertRevision(entry);
        fd = openSync(entry.view.log, "wx", 0o600);
        entry.child = spawn(entry.input.command[0]!, entry.input.command.slice(1), {
          cwd: entry.input.cwd,
          env: { ...entry.input.env, ...(entry.view.kind === "check" ? { AB_CHECK_SLOT: entry.view.id } : {}) },
          detached: true, stdio: ["ignore", fd, fd],
        });
        entry.child.once("error", error => this.finish(entry, 127, error.message));
        entry.child.once("exit", (code, signal) => this.finish(entry, code ?? (signal === "SIGTERM" ? 143 : 137), signal ?? undefined));
      } catch (error) { this.finish(entry, 127, String(error)); }
      finally { if (fd !== undefined) closeSync(fd); }
    }
  }
  private sweep() {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      if (entry.view.status === "done") {
        if (now - entry.view.ended! > 3600_000) {
          this.entries.delete(id);
          rmSync(entry.view.log, { force: true });
        }
        continue;
      }
      if (entry.view.kind === "check") {
        for (const [client, time] of entry.clients) if (now - time > 30_000) entry.clients.delete(client);
        if (!entry.clients.size) this.stopEntry(entry, "caller lease expired");
      }
      if (entry.view.started && now - entry.view.started > entry.input.ttl * 1000) this.stopEntry(entry, "time limit");
    }
  }
}
