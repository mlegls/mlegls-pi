import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { Node } from "./graph";
import { newWindow } from "./actions";
import { workspaces } from "./workspaces";

test("free tmux sessions stay under tmux even inside repos; new windows start at home", () => {
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
esac
`);
		chmodSync(join(bin, "tmux"), 0o755);
		const panes = join(dir, "panes");
		const log = join(dir, "log");
		process.env.AB_TMUX_PANES = panes;
		process.env.AB_TMUX_LOG = log;
		process.env.PATH = bin + ":" + oldPath;
		process.env.TMUX = "test";
		const row = (session: string, tag: string, pane: string) => [session, repo, tag, "0", "shell", "1", pane, "0", "zsh", repo, "1", ""].join("\t");
		writeFileSync(panes, [row("free", "", "%1"), row("repo", "", "%3"), row("tagged", repo, "%2")].join("\n") + "\n");
		const now = new Date().toISOString();
		const live: Node = { id: "live", file: "", cwd: repo, project: "repo", title: "live", created: now, updated: now, state: "idle", pane: "%1", children: [] };
		const ws = workspaces(new Map([[live.id, live]]), { pinned: [repo] });
		const free = ws.get("tmux:free")!;
		expect(free.project).toBe("tmux");
		expect(ws.get("tmux:repo")?.session).toBe("repo");
		expect(free.windows[0]?.session).toBe("free");
		expect(free.agents.map(n => n.id)).toEqual(["live"]);
		expect(ws.get(repo)?.session).toBe("tagged");
		expect(ws.get(repo)?.agents).toEqual([]);
		newWindow(free);
		newWindow(free, "pi", "pi");
		newWindow(ws.get(repo)!);
		const calls = readFileSync(log, "utf8").split("\n");
		const cwdArgs = calls.flatMap((arg, i) => arg === "-c" && calls[i - 1] === "free:" ? [calls[i + 1]] : []);
		expect(cwdArgs).toEqual([homedir(), homedir()]);
		expect(calls.flatMap((arg, i) => arg === "-c" && calls[i - 1] === "tagged:" ? [calls[i + 1]] : [])).toEqual([repo]);
	} finally {
		process.env.PATH = oldPath;
		if (oldTmux === undefined) delete process.env.TMUX; else process.env.TMUX = oldTmux;
		delete process.env.AB_TMUX_PANES;
		delete process.env.AB_TMUX_LOG;
		rmSync(dir, { recursive: true, force: true });
	}
});
