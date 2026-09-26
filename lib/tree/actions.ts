// Actions on session nodes, shared by the ab tree CLI and its TUI. Everything multiplexer-
// specific is here, and it is tmux: panes come from live records (TMUX_PANE), parked sessions
// reopen as `pi --session <file>` in a window of a tmux session named after the project.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Node } from "./graph";

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

/** Focus the node's pane, or reopen a parked/ended session in tmux. Returns a message on refusal. */
export function open(n: Node): string | undefined {
	if (paneAlive(n.pane)) {
		const session = tmux("display-message", "-p", "-t", n.pane, "#{session_name}");
		tmux(...withClient(["switch-client", "-t", session]));
		tmux("select-window", "-t", n.pane);
		tmux("select-pane", "-t", n.pane);
		return;
	}
	if (n.pid) return n.paseoAgent ? "running in Paseo; park it here first to take it over in tmux" : `running as pid ${n.pid} outside tmux`;
	if (!existsSync(n.cwd)) return "its directory is gone: " + n.cwd;
	const session = slug(n.project);
	if (!quiet(() => tmux("has-session", "-t", "=" + session))) tmux("new-session", "-d", "-s", session, "-c", n.cwd);
	const pane = tmux("new-window", "-P", "-F", "#{pane_id}", "-t", session + ":", "-c", n.cwd, "-n", slug(n.handle ?? n.title),
		"pi --session " + JSON.stringify(n.file));
	tmux(...withClient(["switch-client", "-t", session]));
	tmux("select-window", "-t", pane);
}

/** Stop the session's process, keeping its worktree and file: it can be reopened later. */
export function park(n: Node): string | undefined {
	if (n.paseoAgent && n.pid && !paneAlive(n.pane)) {
		const r = spawnSync("paseo", ["archive", n.paseoAgent], { encoding: "utf8" });
		if (r.status !== 0) return "paseo archive failed: " + (r.stderr || r.stdout).trim();
	}
	if (n.pid) quiet(() => process.kill(n.pid!, "SIGTERM"));
	else return "not running";
}

/** Put text in front of the agent as a user message: pasted into its pane, or sent through Paseo. */
export function send(n: Node, text: string): string | undefined {
	if (!text.trim()) return "nothing to send";
	if (paneAlive(n.pane)) {
		execFileSync("tmux", ["load-buffer", "-b", "ab-tree", "-"], { input: text });
		tmux("paste-buffer", "-p", "-d", "-b", "ab-tree", "-t", n.pane);
		tmux("send-keys", "-t", n.pane, "Enter");
		return;
	}
	if (n.paseoAgent && n.pid) {
		const r = spawnSync("paseo", ["send", n.paseoAgent, "--no-wait", text], { encoding: "utf8" });
		return r.status === 0 ? undefined : "paseo send failed: " + (r.stderr || r.stdout).trim();
	}
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
export function tool(kind: "diff" | "wip" | "files" | "edit" | "zed", n: Node): string {
	const q = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";
	const cd = "cd " + q(n.cwd) + " && ";
	switch (kind) {
		case "files": return cd + "yazi";
		case "edit": return cd + "nvim .";
		case "zed": return "zed " + q(n.cwd);
		case "wip": return cd + reviewed("tuicr --no-update-check --stdout -w", n);
		case "diff": {
			const base = reviewBase(n.cwd);
			return cd + reviewed(base ? `tuicr --no-update-check --stdout -r ${base}..HEAD` : "tuicr --no-update-check --stdout -w", n);
		}
	}
}

/** Run tuicr, then offer its exported review to the agent. */
function reviewed(cmd: string, n: Node): string {
	const file = `\${TMPDIR:-/tmp}/ab-tree-review-${n.id}.md`;
	return `${cmd} > "${file}"; if [ -s "${file}" ]; then printf 'send review to the agent? [y/N] '; read -r a; [ "$a" = y ] && ${AB} tree send ${n.id} < "${file}"; fi`;
}

/** Run a tool line: in a tmux popup over the current client (sidebar), or in this terminal (dashboard). */
export function run(line: string, where: "popup" | "here"): void {
	if (line.startsWith("zed ")) { spawnSync("sh", ["-c", line], { stdio: "ignore" }); return; }
	if (where === "popup") tmux(...withClient(["display-popup", "-E", "-w", "92%", "-h", "90%", line]));
	else spawnSync("sh", ["-c", line], { stdio: "inherit" });
}
