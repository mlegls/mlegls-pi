// The vault tracker as this plugin sees it: issues.ts (the tracker skill's CLI) run from a pinned copy, so a merge in
// progress in the live mlegls-pi checkout can't break reads (the same reason lib/reconcile pins it). Everything the
// views show comes from \`issues.ts snapshot --json\`; this plugin never writes issues itself.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

import type { Snapshot } from "./model";

const home = homedir();
const expand = (p: string) => (p.startsWith("~/") ? join(home, p.slice(2)) : p);

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/** The vault for a checkout: docs/issues in the git common dir's main worktree, as issues.ts resolves it. */
export function trackerRoot(path: string): string | undefined {
	let main = path;
	try { main = dirname(resolve(path, git(path, "rev-parse", "--git-common-dir"))); } catch {}
	return existsSync(join(main, "docs", "issues")) ? main : undefined;
}

/** bun, found once: the daemon's PATH may not carry a version manager's shims. */
let bunPath: string | undefined;
export function bun(configured: string): string {
	if (configured) return expand(configured);
	if (bunPath) return bunPath;
	try { bunPath = execFileSync(process.env.SHELL || "/bin/zsh", ["-lc", "command -v bun"], { encoding: "utf8" }).trim().split("\n").at(-1); } catch {}
	if (!bunPath || !existsSync(bunPath)) bunPath = [join(home, ".bun/bin/bun"), "/opt/homebrew/bin/bun", "/usr/local/bin/bun"].find(existsSync) ?? "bun";
	return bunPath;
}

/** The tracker scripts as committed at HEAD of the checkout they live in, unpacked once per commit (lib/reconcile
 * pinTracker; shared with it through the same directory). */
export function pinTracker(live: string): string {
	const scripts = realpathSync(dirname(expand(live)));
	const top = git(scripts, "rev-parse", "--show-toplevel");
	const head = git(top, "rev-parse", "HEAD");
	const sub = relative(top, scripts);
	const dir = join(process.env.XDG_STATE_HOME ?? join(home, ".local/state"), "mlegls-pi", "tracker-pin", head);
	const pinned = join(dir, sub, basename(live));
	if (existsSync(pinned)) return pinned;
	const temp = dir + "." + process.pid + ".tmp";
	rmSync(temp, { recursive: true, force: true });
	mkdirSync(temp, { recursive: true });
	execFileSync("bash", ["-c", 'git -C "$1" archive "$2" -- lib "$3" package.json tsconfig.json | tar -x -C "$4"', "_", top, head, sub, temp]);
	symlinkSync(join(top, "node_modules"), join(temp, "node_modules"));
	if (existsSync(join(scripts, "node_modules"))) symlinkSync(join(scripts, "node_modules"), join(temp, sub, "node_modules"));
	try { renameSync(temp, dir); } catch { rmSync(temp, { recursive: true, force: true }); if (!existsSync(pinned)) throw new Error("tracker pin failed: " + dir); }
	return pinned;
}

/** The pinned copy's checkout: lib/board lives beside the tracker scripts there. */
export const pinnedTop = (pinned: string, live: string) => {
	const scripts = realpathSync(dirname(expand(live)));
	return join(dirname(pinned), relative(scripts, git(scripts, "rev-parse", "--show-toplevel")));
};

export interface Cli { bun: string; script: string }

export async function tracker(cli: Cli, root: string, args: string[]): Promise<string> {
	const env = { ...process.env, PATH: dirname(cli.bun) + ":" + (process.env.PATH ?? "") };
	const { stdout } = await run(cli.bun, [cli.script, ...args], { cwd: root, env, maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
	return stdout;
}

interface Row {
	slug: string; file?: string; next?: string; archived: boolean; legacy: boolean; ownStage: string | null; effectiveStage: string | null;
	assignee?: string | null; priority?: number | null; partOf?: string | null; blockedBy?: string[]; guards?: string[];
	ready?: boolean; eligible?: boolean; frontier?: boolean; done?: boolean; deferred?: boolean;
	blockers?: unknown[]; claims?: unknown[];
}
const label = (v: unknown): string => typeof v === "string" ? v : v && typeof v === "object" ? String((v as Record<string, unknown>).slug ?? (v as Record<string, unknown>).value ?? JSON.stringify(v)) : String(v);

export async function snapshot(cli: Cli, root: string): Promise<Snapshot> {
	const out = JSON.parse(await tracker(cli, root, ["snapshot", "--json"])) as { issues: Row[]; legacy?: Row[] };
	// Legacy rows (`next:` instead of `stage:`) carry no file or readiness; they are shown, never actionable.
	const rows = [...out.issues, ...(out.legacy ?? []).map(r => ({ ...r, legacy: true, done: r.next === "done", ownStage: r.next ? "next: " + r.next : null, effectiveStage: null }))];
	return {
		root, repo: basename(root), at: Date.now(),
		issues: rows.map(r => ({
			slug: r.slug, path: r.file ? relative(root, r.file) : join("docs", "issues", r.archived ? "archive" : "", r.slug + ".md"), archived: !!r.archived, legacy: !!r.legacy,
			ownStage: r.ownStage ?? null, effectiveStage: r.effectiveStage ?? null, assignee: r.assignee ?? null,
			priority: r.priority ?? null, partOf: r.partOf ?? null, blockedBy: r.blockedBy ?? [], guards: r.guards ?? [],
			ready: !!r.ready, eligible: !!r.eligible, frontier: !!r.frontier, done: !!r.done, deferred: !!r.deferred,
			blockers: (r.blockers ?? []).map(label), claims: (r.claims ?? []).map(label),
		})),
	};
}

/** An issue file's body without its frontmatter, and the frontmatter as text. */
export function readIssue(root: string, path: string): { frontmatter: string; body: string } {
	const full = resolve(root, path);
	if (!full.startsWith(join(root, "docs", "issues") + "/")) throw new Error("not an issue path: " + path);
	const text = readFileSync(full, "utf8");
	const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
	return m ? { frontmatter: m[1], body: text.slice(m[0].length) } : { frontmatter: "", body: text };
}
