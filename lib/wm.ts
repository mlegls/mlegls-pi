import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agent, AGENTS_DIR, roleBody, type Agent } from "./agents.ts";
import { newThread, type WorkerCheckout, type WorkerThread } from "./thread";
import { commonDir } from "./thread/git";
import type { WorkerRoute } from "./thread/types";
import { workerExecution } from "./worker-execution";

export interface SpawnOptions {
	run: string;
	handle: string;
	issue?: string;
	prompt: string;
	model?: string;
	after?: WorkerRoute;
	effort?: string;
	agent?: string;
	role?: string;
	base?: string;
	adoptHead?: string;
	/** Before setup and launch; may replace the task prompt. */
	prepare?: (cwd: string) => Promise<string | void>;
	cwd?: string;
	parentSession?: string;
	parentThread?: string;
	/** Choose ownership atomically with bb creation, after prepare/setup. */
	withOwner?: (create: (owner: { thread: string; session?: string }) => Promise<string>) => Promise<string>;
}

export function pidAlive(pid: number): boolean {
	try { process.kill(pid, 0); return true; }
	catch (error) { if ((error as { code?: string }).code === "ESRCH") return false; throw error; }
}

/** Universal preamble, then role, stance and task. */
function prompt(o: SpawnOptions, a?: Agent, task = o.prompt): string {
	const file = join(AGENTS_DIR, "_common.md");
	const common = existsSync(file) ? readFileSync(file, "utf8") : "report by ending your turn with done, blocked, or needs-input as its first word.";
	const role = o.role ?? a?.roles[0];
	const fill = (text: string) => text.replaceAll("{{run}}", o.run).replaceAll("{{handle}}", o.handle).replaceAll("{{topic}}", `${o.run}/${o.handle}`).trim();
	return [fill(common), role && fill(roleBody(role)), a && fill(a.body), task].filter(Boolean).join("\n\n---\n\n");
}

export function spawnEnv(o: { run: string; handle: string; issue?: string; agent?: string; parentSession?: string; checkpoint?: string }): string[] {
	return [
		o.agent && `PI_WM_AGENT=${o.agent}`,
		`PI_WM_RUN=${o.run}`,
		`PI_WM_HANDLE=${o.handle}`,
		o.issue && `PI_WM_ISSUE=${o.issue}`,
		o.parentSession && `PI_WM_PARENT_SESSION=${o.parentSession}`,
		o.checkpoint && `PI_CHECKPOINT=${o.checkpoint}`,
		process.env.PI_CODING_AGENT_DIR && `PI_CODING_AGENT_DIR=${process.env.PI_CODING_AGENT_DIR}`,
	].filter((v): v is string => Boolean(v));
}

export async function excludeWm(cwd: string) {
	const gitDir = commonDir(cwd);
	if (!gitDir) return;
	const file = join(gitDir, "info", "exclude");
	const cur = existsSync(file) ? readFileSync(file, "utf8") : "";
	if (cur.split("\n").includes(".wm/")) return;
	mkdirSync(join(gitDir, "info"), { recursive: true });
	appendFileSync(file, `${cur.endsWith("\n") || cur === "" ? "" : "\n"}.wm/\n`);
}

export async function spawn(o: SpawnOptions): Promise<WorkerThread> {
	const a = o.agent ? agent(o.agent) : undefined;
	if (o.agent && !a) throw new Error("Unknown agent stance: " + o.agent);
	if ((o as { command?: unknown }).command !== undefined) throw new Error("wm.spawn runs a BB thread; a worker command is not supported");
	const cwd = resolve(o.cwd ?? process.cwd());
	const execution = await workerExecution({ agent: a, model: o.model, effort: o.effort, after: o.after, project: cwd });
	await excludeWm(cwd);
	const env = Object.fromEntries(spawnEnv({ run: o.run, handle: o.handle, issue: o.issue, agent: a?.name, parentSession: o.parentSession, checkpoint: a?.checkpoint }).map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1)]; }));
	return newThread({ cwd, parent: o.parentThread, worktree: o.handle, base: o.base, adoptHead: o.adoptHead,
		createThread: o.withOwner ? create => o.withOwner!(owner => {
			env.PI_WM_RECONCILER_RUN = o.run;
			if (owner.session) env.PI_WM_PARENT_SESSION = owner.session;
			else delete env.PI_WM_PARENT_SESSION;
			return create(owner.thread);
		}) : undefined,
		prepare: o.prepare ? async (thread: WorkerCheckout) => {
			const prepared = await o.prepare!(thread.cwd);
			if (prepared !== undefined) thread.launch!.prompt = prompt(o, a, prepared);
		} : undefined,
		worker: { run: o.run, handle: o.handle },
		launch: { execution, env, prompt: prompt(o, a) },
	});
}
