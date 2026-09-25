// Idle-agent reaper as an ab daemon job. Paseo keeps idle agent runtimes resident indefinitely
// (time-based collection was removed upstream in getpaseo/paseo#2590) and exposes no way to release
// a runtime while keeping the agent, so under memory pressure this archives long-idle agents, which
// closes their runtimes; they stay restorable from the archive. Policy follows the upstream
// discussion in getpaseo/paseo#2829: time decides eligibility, memory pressure decides necessity.
//   ab daemon job: start("reap", { idleMinutes?, intervalMinutes?, batch?, swapGb?, dryRun? })
// It also kills pi runtimes whose agent is already archived or gone: opening an archived agent's
// timeline in the app resumes its runtime, and nothing closes it again.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as paseo from "../paseo.ts";
import { stateRoot, type JobContext } from "../daemon.ts";

export interface Input { idleMinutes?: number; intervalMinutes?: number; batch?: number; swapGb?: number; dryRun?: boolean }
export interface State { passes: number; archived: string[]; killed: number[] }

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const PARENT = "paseo.parent-agent-id";
const sh = (cmd: string, ...args: string[]) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });

/** macOS pressure level (1 normal, 2 warn, 4 critical) and swap in use, in GB. */
export function pressure(): { level: number; swapGb: number } {
  const level = Number(sh("sysctl", "-n", "kern.memorystatus_vm_pressure_level").trim());
  const used = sh("sysctl", "-n", "vm.swapusage").match(/used = ([\d.]+)M/);
  return { level, swapGb: used ? Number(used[1]) / 1024 : 0 };
}

/** Agent IDs named anywhere in a running ab job (supervise owners and children wake by message). */
function heldByJobs(): Set<string> {
  const held = new Set<string>();
  const index = join(stateRoot(), "jobs.json");
  if (!existsSync(index)) return held;
  for (const file of JSON.parse(readFileSync(index, "utf8")) as string[]) {
    try {
      const text = readFileSync(file, "utf8");
      if ((JSON.parse(text) as { status?: string }).status === "running") for (const id of text.match(UUID) ?? []) held.add(id);
    } catch {}
  }
  return held;
}

/** pi RPC runtimes started by Paseo: pid, agent ID and age in seconds. */
function runtimes(): { pid: number; agentId: string; ageS: number }[] {
  const out: { pid: number; agentId: string; ageS: number }[] = [];
  for (const line of sh("ps", "-Ao", "pid=,etime=,command=", "-ww", "-E").split("\n")) {
    if (!line.includes("pi-coding-agent") || !line.includes("--mode rpc")) continue;
    const id = line.match(/PASEO_AGENT_ID=(\S+)/)?.[1];
    const [pid, etime] = line.trim().split(/\s+/);
    if (!id || !pid || !etime) continue;
    const [d, rest] = etime.includes("-") ? etime.split("-") : ["0", etime];
    const parts = rest!.split(":").map(Number).reverse();
    out.push({ pid: Number(pid), agentId: id, ageS: Number(d) * 86400 + (parts[0] ?? 0) + (parts[1] ?? 0) * 60 + (parts[2] ?? 0) * 3600 });
  }
  return out;
}

export async function pass(input: Input, log: (line: string) => void): Promise<{ archived: string[]; killed: number[] }> {
  const idleMs = (input.idleMinutes ?? 60) * 60_000;
  const { level, swapGb } = pressure();
  const entries = await paseo.withClient(async client => (await client.agents.list({ page: { limit: 200 } })).entries);
  const agents = entries.map(entry => entry.agent);
  const live = new Set(agents.map(agent => agent.id));

  // Runtimes of archived or deleted agents: always reclaimable. Grace period covers agents created after the list.
  const killed: number[] = [];
  for (const runtime of runtimes()) {
    if (live.has(runtime.agentId) || runtime.ageS < 300) continue;
    log(`${input.dryRun ? "would kill" : "kill"} ${runtime.pid}: runtime of archived/unknown agent ${runtime.agentId}`);
    if (!input.dryRun) try { process.kill(runtime.pid, "SIGTERM"); killed.push(runtime.pid); } catch {}
  }

  if (level < 2 && swapGb < (input.swapGb ?? 8)) return { archived: [], killed };

  // Archiving a parent cascades to its children, so any parent of a non-idle agent is off limits.
  const busyParents = new Set(agents.filter(agent => agent.status !== "idle").map(agent => agent.labels?.[PARENT]).filter(Boolean));
  const held = heldByJobs();
  const now = Date.now();
  const eligible = agents
    .filter(agent => agent.status === "idle" && !agent.archivedAt && !agent.activeTurn && !agent.requiresAttention
      && agent.pendingPermissions.length === 0 && !held.has(agent.id) && !busyParents.has(agent.id)
      && now - Date.parse(agent.updatedAt) > idleMs)
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
    .slice(0, input.batch ?? 8);
  const archived: string[] = [];
  log(`pressure level ${level}, swap ${swapGb.toFixed(1)} GB: ${eligible.length} to archive`);
  for (const agent of eligible) {
    log(`${input.dryRun ? "would archive" : "archive"} ${agent.id} ${agent.title ?? ""} (idle since ${agent.updatedAt})`);
    if (input.dryRun) continue;
    try { await paseo.withClient(client => client.agents.ref(agent.id).archive()); archived.push(agent.id); }
    catch (error) { log(`archive ${agent.id} failed: ${String(error)}`); }
  }
  return { archived, killed };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, ms);
    if (signal.aborted) done(); else signal.addEventListener("abort", done, { once: true });
  });
}

export async function run(job: JobContext): Promise<State> {
  const input = (job.input ?? {}) as Input;
  const state: State = { passes: 0, archived: [], killed: [], ...(job.state as State | null) };
  while (!job.signal.aborted) {
    try {
      const result = await pass(input, job.log);
      state.passes++;
      state.archived = [...state.archived, ...result.archived].slice(-200);
      state.killed = [...state.killed, ...result.killed].slice(-200);
      await job.save(state);
    } catch (error) { job.log("pass failed: " + String(error)); }
    await wait((input.intervalMinutes ?? 5) * 60_000, job.signal);
  }
  return state;
}
