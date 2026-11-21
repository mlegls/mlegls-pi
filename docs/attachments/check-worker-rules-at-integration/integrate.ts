// Local integration demo; exercises real Git and the dispatch entry point with a stand-in BB worker inbox.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { integrate } from "../../../lib/dispatch";
import { protocolFixture } from "../../../lib/reconcile/protocol-fixture";

const fixture = protocolFixture();
try {
	const { git, collector } = fixture;
	const worker = fixture.worker("implementer");
	const bypass = process.argv.includes("--hooks-path");
	mkdirSync(join(collector, ".hooks"));
	writeFileSync(join(collector, ".hooks", "pre-commit"), `#!/bin/sh
if git diff --cached -- code.txt | grep -q '^+REJECT'; then
  echo 'pre-commit: remove REJECT from the staged code.txt' >&2
  exit 1
fi
`, { mode: 0o755 });
	git(collector, "config", "--worktree", "core.hooksPath", ".hooks");
	const path = worker.path;
	console.log("Tracker materialized in worker:", existsSync(join(path, "docs", "issues")));
	console.log("Tracker paths still in Git:", git(path, "ls-tree", "-r", "--name-only", "HEAD", "docs/issues").split("\n").filter(Boolean).length);
	const save = (body: string, args: string[]) => {
		writeFileSync(join(path, "code.txt"), body + "\n");
		git(path, "add", "code.txt");
		git(path, ...args);
	};
	const integrateWorker = () => integrate(worker, { cwd: collector, keep: true });
	const parent = git(collector, "rev-parse", "HEAD");
	if (bypass) git(path, "config", "--worktree", "core.hooksPath", "/dev/null");
	else git(path, "config", "--worktree", "core.hooksPath", join(collector, ".hooks"));
	save("REJECT", ["commit", "-qm", "bad content", ...(bypass ? [] : ["--no-verify"])]);
	save("good final tree", ["commit", "-qm", "later repair"]);
	try {
		await integrateWorker();
		console.log("Unexpectedly accepted the bad history");
	} catch (error) { console.log(String(error)); }
	console.log("Parent unchanged:", parent === git(collector, "rev-parse", "HEAD"));
	console.log("Worker branch after refusal:", git(path, "branch", "--show-current"));
	console.log("Worker follow-up:", fixture.bb.threads().find(t => t.id === worker.bb)?.tells.at(-1));
	git(path, "reset", "--soft", parent);
	git(path, "commit", "-qm", "valid history");
	await integrateWorker();
	console.log("Rewritten history landed:", git(collector, "show", "HEAD:code.txt"));
	save("clean follow-on", ["commit", "-qm", "clean follow-on"]);
	await integrateWorker();
	console.log("Clean follow-on landed:", git(collector, "show", "HEAD:code.txt"));
} finally { fixture.close(); }
