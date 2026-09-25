// Per-user process hosting restartable, named jobs. The Unix socket is local IPC only.
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createConnection, createServer, type Socket } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export interface JobContext {
  id: string;
  input: unknown;
  state: unknown;
  save(state: unknown): Promise<void>;
  log(line: string): void;
  signal: AbortSignal;
}
export interface JobRecord {
  id: string;
  type: string;
  input: unknown;
  state: unknown;
  stateFile: string;
  status: "running" | "completed" | "failed" | "stopped";
  result?: unknown;
  error?: string;
}
export interface StartOptions { id?: string; stateFile?: string }

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAEMON_ENTRY = join(ROOT, "ab/daemon.ts");
const JOBS_DIR = join(ROOT, "lib/jobs");
const CONNECT_TIMEOUT = 5000;
const START_TIMEOUT = 15000;
const OWNER_PATIENCE = 20000;

function stateRoot(): string {
  return resolve(process.env.AB_STATE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab"));
}
function socketPath(): string { return join(stateRoot(), "daemon.sock"); }
function indexPath(): string { return join(stateRoot(), "jobs.json"); }
function pidPath(): string { return join(stateRoot(), "daemon.pid"); }
/** PID in daemon.pid when that process is still an ab daemon; guards against PID reuse. */
function liveOwner(): number | undefined {
  let pid: number;
  try { pid = Number(readFileSync(pidPath(), "utf8").trim()); } catch { return undefined; }
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  try {
    const command = execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" });
    return command.includes(DAEMON_ENTRY) ? pid : undefined;
  } catch { return undefined; }
}
const sleep = (ms: number) => new Promise(resolveWait => setTimeout(resolveWait, ms));
function encode(value: unknown): string {
  const text = JSON.stringify(value);
  if (text === undefined) throw new Error("job data must be JSON-serializable");
  return text;
}
function clone<T>(value: T): T { return JSON.parse(encode(value)) as T; }
function validType(type: string): boolean { return /^[a-z][a-z0-9-]*$/.test(type); }
function validId(id: string): boolean { return /^[a-zA-Z0-9_-]+$/.test(id); }
function ensureDirectory(path: string) { mkdirSync(path, { recursive: true, mode: 0o700 }); }

function request<T>(body: Record<string, unknown>): Promise<T> {
  return new Promise((resolveRequest, reject) => {
    const socket = createConnection(socketPath());
    let text = "";
    let settled = false;
    const finish = (error?: Error, result?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error); else resolveRequest(result as T);
    };
    const timeout = setTimeout(() => finish(new Error("timed out talking to ab daemon")), CONNECT_TIMEOUT);
    socket.on("connect", () => socket.write(encode(body) + "\n"));
    socket.on("data", chunk => {
      text += chunk.toString();
      if (text.length > 4 * 1024 * 1024) return finish(new Error("ab daemon response too large"));
      const newline = text.indexOf("\n");
      if (newline < 0) return;
      try {
        const response = JSON.parse(text.slice(0, newline));
        if (!response.ok) finish(new Error(response.error ?? "ab daemon request failed"));
        else finish(undefined, response.value as T);
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
    socket.on("error", error => finish(error));
    socket.on("end", () => { if (!settled) finish(new Error("ab daemon closed without a response")); });
  });
}

async function isLive(): Promise<boolean> {
  try { await request({ method: "status" }); return true; }
  catch { return false; }
}

/** Start the per-user daemon on demand; concurrent callers share its socket. */
export async function ensure(): Promise<void> {
  const root = stateRoot();
  ensureDirectory(root);
  try { chmodSync(root, 0o700); } catch {}
  if (await isLive()) return;
  // A slow daemon (e.g. under memory pressure) must not be replaced while it still owns the
  // socket: that orphans it with its jobs still running. Wait, then restart it explicitly.
  const owner = liveOwner();
  if (owner !== undefined) {
    const patience = Date.now() + OWNER_PATIENCE;
    while (Date.now() < patience) { if (await isLive()) return; await sleep(250); }
    try { process.kill(owner, "SIGTERM"); } catch {}
    for (let i = 0; i < 40 && liveOwner() === owner; i++) await sleep(50);
    if (liveOwner() === owner) try { process.kill(owner, "SIGKILL"); } catch {}
    for (let i = 0; i < 40 && liveOwner() === owner; i++) await sleep(50);
  }
  const lock = join(root, "daemon.starting");
  const token = randomUUID();
  const deadline = Date.now() + START_TIMEOUT;
  let ownedLock = false;
  let child: ReturnType<typeof spawn> | undefined;
  while (Date.now() < deadline) {
    if (await isLive()) return;
    try {
      const fd = openSync(lock, "wx", 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, token, at: Date.now() }));
      closeSync(fd);
      ownedLock = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const owner = JSON.parse(readFileSync(lock, "utf8")) as { pid?: number; at?: number };
        let alive = false;
        if (owner.pid) { try { process.kill(owner.pid, 0); alive = true; } catch (probeError) { alive = (probeError as NodeJS.ErrnoException).code === "EPERM"; } }
        if (!alive && Date.now() - (owner.at ?? 0) > 1000) unlinkSync(lock);
      } catch { try { unlinkSync(lock); } catch {} }
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
      continue;
    }
    try {
      if (await isLive()) return;
      const socket = socketPath();
      if (existsSync(socket)) try { unlinkSync(socket); } catch {}
      const logFd = openSync(join(root, "daemon.log"), "a", 0o600);
      try {
        child = spawn(process.execPath, [DAEMON_ENTRY], {
          cwd: ROOT, env: process.env, detached: true, stdio: ["ignore", logFd, logFd],
        });
      } finally { closeSync(logFd); }
      child.unref();
      while (Date.now() < deadline) {
        if (await isLive()) return;
        if (child.exitCode !== null) throw new Error("ab daemon exited during startup; see " + join(root, "daemon.log"));
        await new Promise(resolveWait => setTimeout(resolveWait, 100));
      }
      throw new Error("ab daemon did not start; see " + join(root, "daemon.log"));
    } catch (error) {
      if (child && child.exitCode === null) child.kill("SIGTERM");
      throw error;
    } finally {
      if (ownedLock) {
        try {
          const current = JSON.parse(readFileSync(lock, "utf8"));
          if (current.token === token) unlinkSync(lock);
        } catch {}
      }
    }
  }
  throw new Error("timed out waiting for ab daemon startup");
}

export async function start(type: string, input: unknown, options: StartOptions = {}): Promise<JobRecord> {
  if (!validType(type)) throw new Error("job type must be a simple module name");
  const id = options.id ?? randomUUID();
  if (!validId(id)) throw new Error("job id must contain only letters, numbers, _ or -");
  const stateFile = options.stateFile ? resolve(options.stateFile) : undefined;
  await ensure();
  return request<JobRecord>({ method: "start", type, input: clone(input), id, stateFile });
}

export async function status(): Promise<JobRecord[]> {
  await ensure();
  return request<JobRecord[]>({ method: "status" });
}

export async function stop(id: string): Promise<JobRecord> {
  await ensure();
  return request<JobRecord>({ method: "stop", id });
}

export async function shutdown(): Promise<void> {
  await ensure();
  await request<boolean>({ method: "shutdown" });
}

function writeAtomic(path: string, value: unknown) {
  ensureDirectory(dirname(path));
  const temporary = path + "." + process.pid + "." + randomUUID() + ".tmp";
  writeFileSync(temporary, encode(value), { mode: 0o600 });
  renameSync(temporary, path);
}

function publicRecord(record: JobRecord): JobRecord { return clone(record); }

/** Entrypoint used only by ab/daemon.ts. */
export async function runDaemon(): Promise<void> {
  const root = stateRoot();
  ensureDirectory(root);
  try { chmodSync(root, 0o700); } catch {}
  const socket = socketPath();
  const index = indexPath();
  const records = new Map<string, JobRecord>();
  const controllers = new Map<string, AbortController>();
  let writeQueue = Promise.resolve();
  let stopping = false;

  const owner = liveOwner();
  if (owner !== undefined && owner !== process.pid) {
    console.error("ab daemon: " + owner + " already owns " + socket + "; exiting");
    process.exit(0);
  }
  if (existsSync(index)) {
    const files = JSON.parse(readFileSync(index, "utf8")) as string[];
    if (!Array.isArray(files)) throw new Error("invalid ab daemon job index");
    for (const file of files) {
      try {
        const record = JSON.parse(readFileSync(file, "utf8")) as JobRecord;
        if (record && validId(record.id) && validType(record.type) && typeof record.stateFile === "string") records.set(record.id, record);
      } catch (error) { console.error("ab daemon: cannot load job record", file, String(error)); }
    }
  }

  function persist(record: JobRecord): Promise<void> {
    records.set(record.id, record);
    const snapshot = publicRecord(record);
    writeQueue = writeQueue.catch(() => {}).then(() => {
      writeAtomic(snapshot.stateFile, snapshot);
      writeAtomic(index, [...records.values()].map(item => item.stateFile));
    });
    return writeQueue;
  }

  function runJob(record: JobRecord): void {
    if (stopping || record.status !== "running" || controllers.has(record.id)) return;
    const controller = new AbortController();
    controllers.set(record.id, controller);
    const context: JobContext = {
      id: record.id,
      input: record.input,
      state: record.state,
      save: async state => { record.state = clone(state); await persist(record); },
      log: line => console.log("[" + record.id + "] " + String(line)),
      signal: controller.signal,
    };
    void (async () => {
      try {
        const modulePath = join(JOBS_DIR, record.type + ".ts");
        const job = await import(modulePath) as { run?: (context: JobContext) => Promise<unknown> };
        if (typeof job.run !== "function") throw new Error("lib/jobs/" + record.type + ".ts must export run()");
        const result = await job.run(context);
        if (record.status === "running") {
          if (result !== undefined) record.result = clone(result);
          record.status = "completed";
          await persist(record);
        }
      } catch (error) {
        if (record.status === "running") {
          record.status = "failed";
          record.error = error instanceof Error ? error.message : String(error);
          try { await persist(record); } catch (saveError) { console.error("ab daemon: could not persist failed job", record.id, String(saveError)); }
        }
        console.error("ab daemon: job failed", record.id, String(error));
      } finally { controllers.delete(record.id); }
    })();
  }

  async function handle(message: any): Promise<{ value?: unknown; shutdown?: boolean }> {
    switch (message?.method) {
      case "status": return { value: [...records.values()].map(publicRecord).sort((a, b) => a.id.localeCompare(b.id)) };
      case "start": {
        if (!validType(message.type) || !validId(message.id)) throw new Error("invalid job type or id");
        if (records.has(message.id)) throw new Error("job id already exists: " + message.id);
        const input = clone(message.input);
        const file = typeof message.stateFile === "string" ? resolve(message.stateFile) : join(root, "jobs", message.id + ".json");
        const record: JobRecord = { id: message.id, type: message.type, input, state: null, stateFile: file, status: "running" };
        await persist(record);
        runJob(record);
        return { value: publicRecord(record) };
      }
      case "stop": {
        const record = records.get(message.id);
        if (!record) throw new Error("unknown job: " + message.id);
        if (record.status === "running") {
          record.status = "stopped";
          await persist(record);
          controllers.get(record.id)?.abort();
        }
        return { value: publicRecord(record) };
      }
      case "shutdown":
        stopping = true;
        return { value: true, shutdown: true };
      default: throw new Error("unknown ab daemon request");
    }
  }

  const loaded = [...records.values()].filter(record => record.status === "running");
  const server = createServer((client: Socket) => {
    let buffer = "";
    // Clients time out and hang up; a late reply must not crash the daemon with EPIPE.
    client.on("error", () => {});
    client.on("data", chunk => {
      buffer += chunk.toString();
      if (buffer.length > 4 * 1024 * 1024) { client.end(encode({ ok: false, error: "request too large" }) + "\n"); return; }
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      client.pause();
      void (async () => {
        try {
          const message = JSON.parse(buffer.slice(0, newline));
          const result = await handle(message);
          client.end(encode({ ok: true, value: result.value }) + "\n");
          if (result.shutdown) setTimeout(() => process.exit(0), 20);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          client.end(encode({ ok: false, error: detail }) + "\n");
        }
      })();
    });
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(socket, () => { server.removeListener("error", reject); resolveListen(); });
  });
  try { chmodSync(socket, 0o600); } catch {}
  writeFileSync(pidPath(), String(process.pid) + "\n", { mode: 0o600 });
  const owns = () => { try { return Number(readFileSync(pidPath(), "utf8").trim()) === process.pid; } catch { return false; } };
  process.once("exit", () => { if (owns()) { try { unlinkSync(socket); } catch {} try { unlinkSync(pidPath()); } catch {} } });
  // Replaced by another daemon (its pidfile overwrote ours): exit rather than run jobs twice.
  setInterval(() => { if (!owns()) { console.error("ab daemon: " + process.pid + " lost ownership; exiting"); process.exit(0); } }, 10_000).unref();
  process.once("SIGTERM", () => process.exit(0));
  for (const record of loaded) runJob(record);
}
