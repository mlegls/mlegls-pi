import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, openSync, readSync, realpathSync } from "node:fs";
import { DaemonRequestTimeout, resource } from "../lib/daemon.ts";
import type { Execution, Submission } from "../lib/resources/host.ts";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function resources(kind: "check" | "service", args: string[]) {
  if (kind === "service" && args[0] === "stop") {
    if (args.length !== 2) throw new Error("ab service stop ID");
    await resource({ action: "stop", id: args[1] });
    return;
  }
  if (!args.length || args[0] === "list") {
    const entries = await resource<Execution[]>({ action: "list" });
    console.log(JSON.stringify(entries.filter(entry => entry.kind === kind), null, 2));
    return;
  }
  if (kind === "service") {
    if (args.shift() !== "start") throw new Error("ab service start [--ttl SECONDS] -- COMMAND ARG...");
  }
  const split = args.indexOf("--");
  if (split < 0 || split === args.length - 1) throw new Error("expected -- COMMAND ARG...");
  let ttl = kind === "check" ? 3600 : 1800;
  let share: string | undefined;
  for (let i = 0; i < split; i += 2) {
    const value = args[i + 1];
    if (i + 1 >= split) throw new Error("missing option value");
    if (args[i] === "--ttl") ttl = Number(value);
    else if (args[i] === "--share" && kind === "check") share = value;
    else throw new Error("unknown option: " + args[i]);
  }
  if (!Number.isFinite(ttl) || ttl < 1 || ttl > 86400) throw new Error("ttl must be 1–86400 seconds");
  const command = args.slice(split + 1);
  // Nested checks belong to the already-admitted task tree, not a second queue slot.
  if (kind === "check" && process.env.AB_CHECK_SLOT) {
    const parent = await resource<Execution>({ action: "get", id: process.env.AB_CHECK_SLOT });
    if (parent.kind !== "check" || parent.status !== "running") throw new Error("expired parent check slot");
    const child = spawn(command[0]!, command.slice(1), { stdio: "inherit" });
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", code => resolve(code ?? 1));
    });
    return;
  }
  const cwd = realpathSync(process.cwd());
  let revision: string | undefined;
  if (share !== undefined) {
    if (!share.trim()) throw new Error("share identity must not be empty");
    const git = (...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
    if (git("status", "--porcelain", "--untracked-files=all")) throw new Error("--share requires a clean worktree; omit it for mutable checks");
    // Include all tracked inputs via HEAD. The caller names ignored/environmental inputs.
    revision = git("rev-parse", "HEAD");
    share = createHash("sha256").update(JSON.stringify([revision, share])).digest("hex");
  }
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined));
  const input: Submission = { kind, command, cwd, env, ttl, share, revision };
  const { execution, client } = await resource<{ execution: Execution; client: string }>({ action: "submit", input });
  if (kind === "service") {
    console.log(JSON.stringify(execution, null, 2));
    return;
  }
  console.error(`check ${execution.id} (${execution.status}); log ${execution.log}`);
  let offset = 0;
  const output = async () => {
    let fd: number;
    try { fd = openSync(execution.log, "r"); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
    try {
      const buffer = Buffer.alloc(64 * 1024);
      // Bound each read batch so a noisy child cannot starve its caller heartbeat.
      for (let bytes = 0; bytes < 1024 * 1024;) {
        const n = readSync(fd, buffer, 0, buffer.length, offset);
        if (!n) return false;
        await new Promise<void>((resolve, reject) => process.stdout.write(buffer.subarray(0, n), error => error ? reject(error) : resolve()));
        offset += n;
        bytes += n;
      }
      return true;
    } finally { closeSync(fd); }
  };
  let interrupted = 0;
  const term = () => { interrupted = 143; };
  const int = () => { interrupted = 130; };
  process.on("SIGTERM", term);
  process.on("SIGINT", int);
  try {
    while (!interrupted) {
      let current: Execution;
      try {
        current = await resource<Execution>({ action: "get", id: execution.id, client });
      } catch (error) {
        if (!(error instanceof DaemonRequestTimeout)) throw error;
        // The request may have reached the daemon. Keep ownership and recover the
        // same receipt; submitting again could repeat a command with effects.
        console.error(`check ${execution.id}: daemon request timed out; retrying receipt`);
        await delay(500);
        continue;
      }
      const more = await output();
      if (current.status === "done" && !more) {
        if (current.reason) console.error("check: " + current.reason);
        process.exitCode = current.code ?? 1;
        return;
      }
      if (!more) await delay(500);
    }
    process.exitCode = interrupted;
  } finally {
    process.off("SIGTERM", term);
    process.off("SIGINT", int);
    await resource({ action: "release", id: execution.id, client }).catch(() => {});
  }
}
