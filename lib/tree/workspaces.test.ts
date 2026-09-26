import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { Node } from "./graph";
import { newFreeSession, newWindow } from "./actions";
import { workspaces } from "./workspaces";

test("tmux sessions join projects by session or pane workspace, and free sessions start at home", () => {
	const dir = mkdtempSync(join(tmpdir(), "ab-tree-tmux-"));
	const oldPath = process.env.PATH;
	const oldTmux = process.env.TMUX;
	try {
		const repo = join(realpathSync(dir), "repo");
		mkdirSync(repo);
		execFileSync("git", ["init", "-q", repo]);
		const bin = join(dir, "bin");
		mkdirSync(bin);
		writeFileSync(join(bin, "tmux"), `#!/bin/sh
printf '%s\\n' "$@" >> "$AB_TMUX_LOG"
case "$1" in
  list-panes) cat "$AB_TMUX_PANES" ;;
  has-session) exit 0 ;;
  new-window) printf '%%9\\n' ;;
  new-session) printf 'scratch\\n' ;;
esac
`);
		chmodSync(join(bin, "tmux"), 0o755);
		const panes = join(dir, "panes");
		const log = join(dir, "log");
		process.env.AB_TMUX_PANES = panes;
		process.env.AB_TMUX_LOG = log;
		process.env.PATH = bin + ":" + oldPath;
		process.env.TMUX = "test";
		const row = (session: string, tag: string, pane: string, sessionPath = repo, panePath = repo) => [session, sessionPath, tag, "0", "shell", "1", pane, "0", "zsh", panePath, "1", ""].join("\t");
		writeFileSync(panes, row("wander", "", "%4", homedir(), repo) + "\n");
		const discovered = workspaces(new Map()); // neither pinned nor an agent: find the repo from the pane
		expect(discovered.get(repo)?.windows[0]?.session).toBe("wander");
		writeFileSync(panes, [row("free", "", "%1", homedir(), homedir()), row("repo", "", "%3"), row("wander", "", "%4", homedir(), repo), row("tagged", repo, "%2")].join("\n") + "\n");
		const now = new Date().toISOString();
		const live: Node = { id: "live", file: "", cwd: repo, project: "repo", title: "live", created: now, updated: now, state: "idle", interactive: true, pane: "%4", children: [] };
		const ws = workspaces(new Map([[live.id, live]]), { pinned: [repo] });
		const free = ws.get("tmux:free")!;
		expect(free.project).toBe("tmux");
		expect(ws.has("tmux:repo")).toBe(false);
		expect(ws.has("tmux:wander")).toBe(false);
		expect(free.windows[0]?.session).toBe("free");
		expect(free.agents).toEqual([]);
		expect(ws.get(repo)?.session).toBe("tagged");
		expect(ws.get(repo)?.windows.map(win => win.session)).toEqual(["repo", "wander", "tagged"]);
		expect(ws.get(repo)?.agents.map(n => n.id)).toEqual(["live"]);
		newWindow(free);
		newWindow(free, "pi", "pi");
		newWindow(ws.get(repo)!);
		newFreeSession();
		newFreeSession("pi");
		const calls = readFileSync(log, "utf8").split("\n");
		const cwdArgs = calls.flatMap((arg, i) => arg === "-c" && calls[i - 1] === "free:" ? [calls[i + 1]] : []);
		expect(cwdArgs).toEqual([homedir(), homedir()]);
		expect(calls.flatMap((arg, i) => arg === "-c" && calls[i - 1] === "tagged:" ? [calls[i + 1]] : [])).toEqual([repo]);
		const created = calls.flatMap((arg, i) => arg === "new-session" ? [calls.slice(i, calls.indexOf("switch-client", i))] : []);
		expect(created).toHaveLength(2);
		expect(created.every(args => args.includes(homedir()) && !args.includes("@ab-workspace"))).toBe(true);
		expect(created[0]?.includes("-n")).toBe(false);
		expect(created[1]?.some(arg => arg.includes("pi; exec "))).toBe(true);
	} finally {
		process.env.PATH = oldPath;
		if (oldTmux === undefined) delete process.env.TMUX; else process.env.TMUX = oldTmux;
		delete process.env.AB_TMUX_PANES;
		delete process.env.AB_TMUX_LOG;
		rmSync(dir, { recursive: true, force: true });
	}
});
