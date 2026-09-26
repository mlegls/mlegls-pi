// Actions on session nodes, shared by the ab tree CLI and its TUI. Everything multiplexer-
// specific is here, and it is tmux: panes come from live records (TMUX_PANE), parked sessions
// reopen as `pi --session <file>` in a window of a tmux session named after the project.

import { mail } from "../board/mailbox";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import type { Node } from "./graph";
import type { Window, Workspace } from "./workspaces";

/** ab is on PATH inside pi sessions only; tool lines run from plain shells and tmux popups. */
const AB = fileURLToPath(new URL("../../bin/ab", import.meta.url));

const tmux = (...args: string[]) => execFileSync("tmux", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const quiet = (f: () => unknown) => { try { f(); return true; } catch { return false; } };

/** Client to act on: the caller's own when inside tmux, else the most recently active one
 * (a sidebar running in a Ghostty split outside tmux drives the attached client). */
export function client(): string | undefined {
	if (process.env.TMUX) return undefined;
	try {
		return tmux("list-clients", "-F", "#{client_activity} #{client_name}").split("\n").filter(Boolean)
			.sort().pop()?.split(" ").slice(1).join(" ");
	} catch { return undefined; }
}
const withClient = (args: string[]) => { const c = client(); return c ? [...args.slice(0, 1), "-c", c, ...args.slice(1)] : args; };

export function paneAlive(pane?: string): pane is string {
	return !!pane && quiet(() => tmux("display-message", "-p", "-t", pane, "#{pane_id}"));
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40) || "pi";

/** The workspace's tmux session, created (detached, tagged with its path) if it has none. */
export function ensureSession(w: Workspace): string {
	if (w.session && quiet(() => tmux("has-session", "-t", "=" + w.session))) return w.session;
	let name = slug(w.project + "-" + (w.main ? "main" : (w.branch ?? w.path).split("/").pop()!));
	for (let i = 2; quiet(() => tmux("has-session", "-t", "=" + name)); i++) name = name.replace(/-\d+$/, "") + "-" + i;
	tmux("new-session", "-d", "-s", name, "-c", w.path);
	tmux("set-option", "-t", name, "@ab-workspace", w.path);
	return name;
}

export function switchTo(session: string, target?: string): void {
	tmux(...withClient(["switch-client", "-t", "=" + session]));
	if (target) { quiet(() => tmux("select-window", "-t", target)); quiet(() => tmux("select-pane", "-t", target)); }
}

export function openWorkspace(w: Workspace): void { switchTo(ensureSession(w)); }

export function openWindow(win: Window): void { switchTo(win.session, `${win.session}:${win.index}`); }

/** New window in the workspace: pi, a shell, or a given command. */
export function newWindow(w: Workspace, command?: string, name?: string): void {
	const session = ensureSession(w);
	const args = ["new-window", "-P", "-F", "#{pane_id}", "-t", session + ":", "-c", w.key.startsWith("tmux:") ? homedir() : w.path];
	if (name) args.push("-n", name);
	// Through an interactive shell so PATH matches a terminal (pi comes from mise), and the
	// window stays as a shell when the command exits.
	const shell = process.env.SHELL || "/bin/zsh";
	const q = (x: string) => "'" + x.replace(/'/g, "'\\''") + "'";
	if (command) args.push(`${shell} -ic ${q(command + "; exec " + shell + " -i")}`);
	const pane = tmux(...args);
	switchTo(session, pane);
}

/** New untagged tmux session from the tmux heading (not a project workspace). */
export function newFreeSession(command?: string): void {
	const args = ["new-session", "-d", "-P", "-F", "#{session_name}", "-c", homedir()];
	if (command) {
		const shell = process.env.SHELL || "/bin/zsh";
		const q = (x: string) => "'" + x.replace(/'/g, "'\\''") + "'";
		args.push("-n", "pi", `${shell} -ic ${q(command + "; exec " + shell + " -i")}`);
	}
	switchTo(tmux(...args));
}

/** Focus the node's pane, or resume it with pi --session in a new window of its workspace. */
export function open(n: Node, w?: Workspace): string | undefined {
	if (paneAlive(n.pane)) {
		const session = tmux("display-message", "-p", "-t", n.pane, "#{session_name}");
		switchTo(session, n.pane);
		return;
	}
	if (n.pid) return `running as pid ${n.pid} outside tmux; z stops it, then enter resumes it here`;
	if (!existsSync(n.cwd)) return "its directory is gone: " + n.cwd;
	if (!w) return "no workspace for " + n.cwd;
	newWindow(w, "pi --session " + JSON.stringify(n.file), slug((n.handle ?? n.title).slice(0, 24)));
}

export function killWindow(win: Window): void { tmux("kill-window", "-t", `${win.session}:${win.index}`); }
export function killSession(w: Workspace): void { if (w.session) tmux("kill-session", "-t", "=" + w.session); }

/** Remove only a clean, idle worktree. Git preserves its branch; never force removal. */
export function pruneWorktree(root: string, path: string): "removed" | "dirty" | "busy" {
	const realPath = realpathSync(path);
	const listed = execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], { encoding: "utf8" });
	if (realPath === realpathSync(root) || !listed.split("\n").includes(`worktree ${realPath}`)) {
		throw new Error(`not a worktree of ${root}: ${path}`);
	}
	// Ignore only idle tmux pane shells, not arbitrary shells or background jobs.
	const processes = execFileSync("ps", ["-axo", "pid=,ppid=,comm="], { encoding: "utf8" })
		.trim().split("\n").map(line => line.trim().split(/\s+/));
	const parents = new Set(processes.map(([, ppid]) => Number(ppid)));
	const shells = new Set(processes.filter(([, , command]) => /(^|\/|-)(ba|z|fi|da|k)?sh$/.test(command ?? "")).map(([pid]) => Number(pid)));
	let panes = "";
	try { panes = tmux("list-panes", "-a", "-F", "#{pane_pid}"); } catch { /* No tmux server. */ }
	const idle = new Set(panes.split("\n").map(Number).filter(pid => shells.has(pid) && !parents.has(pid)));
	const listing = execFileSync("lsof", ["-d", "cwd", "-Fpn"], { encoding: "utf8" });
	let pid = 0;
	for (const line of listing.split("\n")) {
		if (line.startsWith("p")) pid = Number(line.slice(1));
		if (line.startsWith("n") && !idle.has(pid) && (line.slice(1) === realPath || line.slice(1).startsWith(realPath + "/"))) return "busy";
	}
	if (execFileSync("git", ["-C", realPath, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim()) return "dirty";
	execFileSync("git", ["-C", root, "worktree", "remove", realPath], { encoding: "utf8" });
	return "removed";
}
/** Paste text into a pane and press enter. */
export function sendToPane(pane: string, text: string): void {
	execFileSync("tmux", ["load-buffer", "-b", "ab-tree", "-"], { input: text });
	tmux("paste-buffer", "-p", "-d", "-b", "ab-tree", "-t", pane);
	tmux("send-keys", "-t", pane, "Enter");
}

/** Session the current client is looking at. */
export function currentSession(): string | undefined {
	try { const c = client(); return tmux("display-message", "-p", ...(c ? ["-c", c] : []), "#{session_name}"); } catch { return undefined; }
}

export function capturePane(pane: string, lines: number): string[] | undefined {
	try { return tmux("capture-pane", "-e", "-p", "-J", "-t", pane, "-S", "-" + lines).split("\n"); } catch { return undefined; }
}

/** Stop the session's process, keeping its worktree and file: it can be reopened later. */
export function park(n: Node): string | undefined {
	if (n.pid) quiet(() => process.kill(n.pid!, "SIGTERM"));
	else return "not running";
}

/** Put text in front of the agent as a user message: pasted into its pane, or for a headless pi a
 * waking message in its mailbox. */
export function send(n: Node, text: string): string | undefined {
	if (!text.trim()) return "nothing to send";
	if (paneAlive(n.pane)) { sendToPane(n.pane, text); return; }
	if (n.pid) { mail(n.id, text, { name: "ab tree" }); return; }
	return "not running; open it first";
}

/** Base for reviewing the node's branch: merge-base with the repo's default branch. */
export function reviewBase(cwd: string): string | undefined {
	const git = (...a: string[]) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	for (const ref of [(() => { try { return git("symbolic-ref", "--short", "refs/remotes/origin/HEAD"); } catch { return ""; } })(), "main", "master"]) {
		if (!ref) continue;
		try { const base = git("merge-base", "HEAD", ref); if (base !== git("rev-parse", "HEAD")) return base; } catch {}
	}
	return undefined;
}

/** Last lines of the node's pane, with colors. */
export function capture(n: Node, lines: number): string[] | undefined {
	if (!paneAlive(n.pane)) return undefined;
	try { return tmux("capture-pane", "-e", "-p", "-J", "-t", n.pane, "-S", "-" + lines).split("\n"); }
	catch { return undefined; }
}

/** Shell command lines for the side tools, run in the node's cwd. */
export function tool(kind: "diff" | "wip" | "files" | "edit" | "zed", n: { id: string; cwd: string }, against?: string): string {
	const q = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
	const cd = "cd " + q(n.cwd) + " && ";
	switch (kind) {
		case "files": return cd + "yazi";
		case "edit": return cd + "nvim .";
		case "zed": return "zed " + q(n.cwd);
		case "wip": return cd + reviewed("tuicr --no-update-check --stdout -w", n);
		case "diff": {
			const base = against ? execFileSync("git", ["-C", n.cwd, "merge-base", "HEAD", against], { encoding: "utf8" }).trim() : reviewBase(n.cwd);
			return cd + reviewed(base ? `tuicr --no-update-check --stdout -r ${base}..HEAD` : "tuicr --no-update-check --stdout -w", n);
		}
	}
}

/** Run tuicr, then offer its exported review to the agent. */
function reviewed(cmd: string, n: { id: string }): string {
	const file = `\${TMPDIR:-/tmp}/ab-tree-review-${n.id}.md`;
	return `${cmd} > "${file}"; if [ -s "${file}" ]; then printf 'send review to the agent? [y/N] '; read -r a; [ "$a" = y ] && ${AB} tree send ${n.id} < "${file}"; fi`;
}

/** Run a tool line: in a tmux popup over the current client (sidebar), or in this terminal (dashboard). */
export function run(line: string, where: "popup" | "here"): void {
	if (line.startsWith("zed ")) { spawnSync("sh", ["-c", line], { stdio: "ignore" }); return; }
	if (where === "popup") tmux(...withClient(["display-popup", "-E", "-w", "92%", "-h", "90%", line]));
	else spawnSync("sh", ["-c", line], { stdio: "inherit" });
}
