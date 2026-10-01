// Owned local first-use setup, not an acceptance test. No auth or model calls.
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newThread, allThreads, abandonThread } from "../../../lib/thread";
import { git } from "../../../lib/thread/git";
import { command } from "../../../lib/thread/process";

const [action, input] = process.argv.slice(2);
if (!input) throw new Error("usage: bun fixture.ts prepare|sidebar|main|stop ABSOLUTE_ROOT");
const root = resolve(input), project = join(root, "project");
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const marker = join(root, ".sidebar-owned");
Object.assign(process.env, {
	XDG_STATE_HOME: join(root, "state"), XDG_CACHE_HOME: join(root, "cache"),
	PI_BOARD_DIR: join(root, "board"), PI_CODING_AGENT_DIR: join(root, "agent"), ZMX_DIR: join(root, "zmx"),
});
for (const key of ["AB_THREAD_ID", "PI_SESSION_ID", "PI_SESSION_FILE", "ZMX_SESSION", "ZMX_SESSION_PREFIX", "TMUX", "TMUX_PANE"]) delete process.env[key];
if (action === "prepare") {
	if (existsSync(root)) throw new Error("prepare requires a new owned directory");
	mkdirSync(project, { recursive: true });
	mkdirSync(join(root, "agent"));
	writeFileSync(marker, repo);
	writeFileSync(join(root, "agent", "settings.json"), JSON.stringify({ packages: [repo] }));
	git(project, "init", "-q", "-b", "main");
	git(project, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "--allow-empty", "-m", "fixture");
	const launch = (title: string) => ({ cmd: "printf '" + title + "\\n'; exec sleep 3600" });
	const parent = await newThread({ cwd: project, in: project, launch: launch("Root thread") });
	const child = await newThread({ cwd: project, parent: parent.id, worktree: "sidebar-child", launch: launch("Child thread") });
	const grandchild = await newThread({ cwd: child.cwd, parent: child.id, worktree: "sidebar-grandchild", launch: launch("Grandchild thread") });
	const sibling = await newThread({ cwd: project, parent: parent.id, in: project, launch: launch("Guest sibling") });
	writeFileSync(join(root, "seed.json"), JSON.stringify({ parent, child, grandchild, sibling }, null, 2));
	console.log(JSON.stringify({ root, project, parent: parent.id, child: child.id, grandchild: grandchild.id, sibling: sibling.id }));
} else {
	if (!existsSync(marker) || readFileSync(marker, "utf8") !== repo) throw new Error("not owned by this checkout");
	if (action === "sidebar") {
		process.chdir(project);
		await command(join(repo, "bin/ab"), ["tree", "sidebar"]);
	} else if (action === "main") {
		const { parent } = JSON.parse(readFileSync(join(root, "seed.json"), "utf8"));
		const { attachThread } = await import("../../../lib/thread");
		await attachThread(parent.id);
	} else if (action === "stop") {
		for (const t of await allThreads()) {
			const active = await allThreads();
			if (active.some(a => a.id === t.id)) await abandonThread(t.id);
		}
		rmSync(root, { recursive: true, force: true });
	} else throw new Error("unknown action: " + action);
}
