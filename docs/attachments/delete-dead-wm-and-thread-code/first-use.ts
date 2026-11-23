// Offline dispatch and retirement on disposable Git worktrees and the fake BB CLI.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatch, retire } from "../../../lib/dispatch";
import { abandonThread } from "../../../lib/thread";
import { fakeBb } from "../../../lib/thread/fake-bb";

const root = realpathSync(mkdtempSync(join(tmpdir(), "retire-first-use-")));
const cwd = join(root, "repo");
const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
try {
	for (const key of Object.keys(process.env)) if (/^(?:PI_WM_|PI_SESSION_|BB_|FAKE_BB_)/.test(key)) delete process.env[key];
	Object.assign(process.env, { XDG_STATE_HOME: join(root, "state"), PI_CODING_AGENT_DIR: join(root, "agent"), MISE_TRUSTED_CONFIG_PATHS: root });
	const bb = fakeBb(root);
	mkdirSync(cwd);
	git(cwd, "init", "-qb", "main");
	git(cwd, "config", "user.name", "Fixture");
	git(cwd, "config", "user.email", "fixture@example.invalid");
	git(cwd, "commit", "--allow-empty", "-qm", "seed");
	const wave = await dispatch(["merged", "unmerged", "kept"].map(handle => ({ handle, prompt: "Offline retirement fixture", model: "fake/model", effort: "low" })),
		{ cwd, run: "retire-fixture", active: [], maxConcurrent: 3 });
	const [merged, unmerged, kept] = wave.submitted;
	if (wave.failed || !merged || !unmerged || !kept || wave.submitted.some(h => !existsSync(h.path) || !bb.threads().some(t => t.id === h.bb && !t.archivedAt)))
		throw new Error("Workers not ready: " + JSON.stringify(wave));
	writeFileSync(join(unmerged.path, "work.txt"), "unlanded patch\n");
	git(unmerged.path, "add", "work.txt");
	git(unmerged.path, "commit", "-qm", "unlanded");
	console.log("ready: three fake BB workers on linked worktrees, one with an unmerged commit");
	const cases = [["receipt", merged, () => retire(merged, { cwd })], ["bare handle", unmerged, () => retire(unmerged.handle, { cwd })],
		["explicit keepBranch, merged", kept, () => abandonThread(kept.bb!, { keepBranch: true })]] as const;
	for (const [label, worker, run] of cases) {
		const before = bb.calls().length;
		const retirement = await run();
		console.log(JSON.stringify({ label, retirement,
			threadLists: bb.calls().slice(before).filter(([group, action]) => group === "thread" && action === "list").length,
			archived: !!bb.threads().find(t => t.id === worker.bb)?.archivedAt,
			worktreePresent: existsSync(worker.path), branchPresent: !!git(cwd, "branch", "--list", worker.handle) }, null, 2));
	}
} finally {
	rmSync(root, { recursive: true, force: true });
}
