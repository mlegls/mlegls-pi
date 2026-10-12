// bb (get-bb/bb) as a thread runtime: bb runs pi (its Pi provider) and shows the thread in its desktop, web and mobile
// apps, in place of a zmx terminal running agent-runner. The registry, worktree, setup and integration stay ours.
// bb gives every thread the same environment, so a worker's identity reaches pi through .wm/launch.env in its
// worktree, which bin/bb-pi (bb's BB_PI_BRIDGE_COMMAND) sources before exec'ing pi.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { command, quote } from "./process";
import { threadDir } from "./registry";
import { launchEnv } from "./launch";
import type { ThreadRecord } from "./types";

export type Runtime = "zmx" | "bb";
/** A session running inside bb spawns into bb; PI_THREAD_RUNTIME overrides either way. */
export function defaultRuntime(env = process.env): Runtime {
	const forced = env.PI_THREAD_RUNTIME;
	if (forced === "bb" || forced === "zmx") return forced;
	return env.BB_THREAD_ID ? "bb" : "zmx";
}

const cli = () => process.env.BB_CLI || "bb";
async function bb<T = unknown>(args: string[], cwd?: string): Promise<T> {
	const out = await command(cli(), [...args, "--json"], cwd);
	const value = JSON.parse(out);
	if (value && typeof value === "object" && value.ok === false) throw new Error("bb " + args.join(" ") + ": " + (value.error?.message ?? out));
	return value as T;
}

interface BbProject { id: string; sources: { path: string }[] }
const projects = new Map<string, string>();
/** The bb project whose source is this main checkout, created on first use. */
export async function bbProject(main: string): Promise<string> {
	const hit = projects.get(main);
	if (hit) return hit;
	const all = await bb<BbProject[]>(["project", "list"]);
	let id = all.find(p => p.sources?.some(s => s.path === main))?.id;
	id ??= (await bb<BbProject>(["project", "create", "--root", main, "--name", main.split("/").at(-1)!])).id;
	projects.set(main, id);
	return id;
}

export interface BbThread { id: string; status: "pending" | "idle" | "starting" | "active" | "stopping" | "error"; archivedAt: number | null; parentThreadId: string | null }
/** Unarchived bb threads by id, across projects; hidden ones included. */
export async function bbThreads(): Promise<Map<string, BbThread>> {
	return new Map((await bb<BbThread[]>(["thread", "list", "--include-hidden"])).map(t => [t.id, t]));
}

// A zmx thread inherits its spawner's whole env; a bb thread gets its identity and, when the spawner set them, the
// state locations that isolate a fixture (registry, board, agent and roster dirs).
const IDENTITY = /^(?:AB_THREAD_ID|PI_BOARD_(?:TOPIC|NAME|FOLLOW|DIR)|PI_WM_.*|PI_CHECKPOINT|PI_CODING_AGENT_DIR|PI_AGENTS_DIR|XDG_STATE_HOME)$/;
/** The worker's identity env, for bin/bb-pi to source. */
export function writeLaunchEnv(thread: ThreadRecord): void {
	const env = launchEnv(thread);
	const keys = new Set([...Object.keys(env).filter(k => IDENTITY.test(k)), ...Object.keys(thread.launch?.env ?? {})]);
	mkdirSync(join(thread.cwd, ".wm"), { recursive: true });
	writeFileSync(join(thread.cwd, ".wm", "launch.env"), [...keys].filter(k => env[k] !== undefined).map(k => k + "=" + quote(env[k]!)).join("\n") + "\n");
}

/** pi's --model and --thinking from the launch args; bb passes them as its model and reasoning level. */
function modelOf(thread: ThreadRecord): { model?: string; effort?: string } {
	const args = thread.launch?.args ?? [];
	const at = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
	return { model: at("--model"), effort: at("--thinking") };
}

/** Start the thread's pi in bb under parent (a bb thread id), submitting its launch prompt. */
export async function spawnBb(thread: ThreadRecord, parent: string | undefined): Promise<string> {
	if (thread.launch?.cmd !== undefined) throw new Error("bb runtime runs pi only; a command override needs the zmx runtime");
	writeLaunchEnv(thread);
	const { model, effort } = modelOf(thread);
	const prompt = join(threadDir(), thread.id + ".prompt.md");
	writeFileSync(prompt, thread.launch?.prompt?.trim() || "Continue.", { mode: 0o600 });
	try {
		const title = thread.worker ? thread.worker.run + "/" + thread.worker.handle : thread.branch ?? thread.id;
		const created = await bb<{ id: string }>(["thread", "spawn", "--project", await bbProject(thread.project), "--environment", thread.cwd,
			"--provider", "pi", ...(model ? ["--model", model] : []), ...(effort ? ["--reasoning-level", effort] : []),
			"--title", title, "--prompt-file", prompt, ...(parent ? ["--parent-thread", parent] : [])]);
		return created.id;
	} finally { rmSync(prompt, { force: true }); }
}

export const tellBb = (id: string, text: string) => bb(["thread", "tell", id, text]);
/** Stop the turn and release bb's pi; the thread stays for a later message. */
export const stopBb = (id: string) => bb(["thread", "stop", id]).catch(error => { if (!/not (?:running|active)|idle/i.test(String(error))) throw error; });
export const archiveBb = (id: string) => bb(["thread", "archive", id]);
export const logBb = (id: string) => command(cli(), ["thread", "log", id, "--all"]);
export const openBb = (id: string) => command(cli(), ["thread", "open", id]);
