// Offline walkthrough of a reconcile run. Owns only the setup fixture's temporary root.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prepare, until } from "../../../lib/reconcile/setup-fixture.ts";
import { getTracker } from "../../../lib/tracker.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const f = await prepare(true);
try {
	const implementer = await f.ready("implement");
	console.log("Ready:", implementer.handle, "in", f.root);
	const loaded = join(f.root, "loaded"), plugin = join(loaded, "plugin");
	mkdirSync(plugin, { recursive: true });
	git(loaded, "init", "-qb", "main");
	git(loaded, "config", "user.name", "Fixture");
	git(loaded, "config", "user.email", "fixture@example.invalid");
	writeFileSync(join(plugin, "entry.txt"), "before\n");
	git(loaded, "add", ".");
	git(loaded, "commit", "-qm", "Plugin base");
	writeFileSync(join(f.bb.dir, "plugins.json"), JSON.stringify([{ enabled: true, source: "path:" + plugin, rootDir: plugin }]));
	const worktree = join(implementer.path, ".wm", "foreign work");
	mkdirSync(join(implementer.path, ".wm"), { recursive: true });
	git(loaded, "worktree", "add", "-qb", "plugin-fix", worktree);
	writeFileSync(join(worktree, "plugin", "entry.txt"), "after\n");
	git(worktree, "commit", "-qam", "Plugin fix");
	const commit = git(worktree, "rev-parse", "HEAD");
	console.log("Worker committed", commit, "in", worktree);

	// Neither report includes a commit declaration. Only the review's prose mentions the fix.
	f.turn("done");
	const reviewer = await f.ready("review");
	git(loaded, "worktree", "prune", "--expire", "now");
	console.log("Retired implementer:", f.bb.threads().find(t => t.id === implementer.bb)?.archivedAt != null,
		"— foreign worktree still exists:", existsSync(worktree));
	const evidence = "docs/attachments/review.md";
	mkdirSync(join(reviewer.path, "docs", "attachments"), { recursive: true });
	writeFileSync(join(reviewer.path, evidence), "# Review\n\nThe plugin fix is on plugin-fix.\n");
	git(reviewer.path, "add", evidence);
	git(reviewer.path, "commit", "-qm", "Review packet");
	f.turn("done\n\nThe runtime fix is `" + commit + "` on `plugin-fix`.\n\n" + "\x60\x60\x60json\n" + JSON.stringify({
		stories: [{ story: "Review the plugin fix", outcome: "held" }], evidence: { path: evidence, visual: false, shots: [] },
	}) + "\n\x60\x60\x60");
	const stage = () => getTracker(f.repo).fields("solo").stage;
	const observed = await until(() => f.state()?.exceptions.solo?.text || f.state()?.finished);
	console.log("After local landing:", stage(), "—", observed);
	if (stage() === "ticket") {
		git(loaded, "merge", "--ff-only", commit);
		console.log("After fast-forwarding the loaded checkout:", await until(() => f.state()?.finished), "—", stage());
	}
} finally { await f.close(); }
