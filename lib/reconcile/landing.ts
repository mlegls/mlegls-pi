import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { git } from "./checks";

/** Probe without changing either checkout; the caller holds the integration lock. */
export function landingConflict(cwd: string, target: string, head: string): string | undefined {
	let output: string;
	try {
		git(cwd, "merge-tree", "--write-tree", "--name-only", "-z", target, head);
		return;
	} catch (e: any) {
		// Exit 1 means conflicts; other failures (unsupported Git, missing refs) must not look like a clean probe.
		if (e.status !== 1) throw e;
		output = String(e.stdout);
	}
	// With -z, the tree is followed by conflicted paths, an empty field, then informational messages.
	const files = output.split("\0").slice(1);
	const end = files.indexOf("");
	if (end < 0) throw new Error("Invalid merge-tree conflict output");
	const base = git(cwd, "merge-base", target, head);
	return conflictDetails(cwd, target, base, files.slice(0, end));
}

export function conflictDetails(cwd: string, target: string, base: string, files: string[]): string {
	return "merge conflict against " + target + "\n" + files.map(file =>
		"\n" + file + "\n" + (git(cwd, "log", "--oneline", base + ".." + target, "--", file) || "(no target commits since merge base)")
	).join("\n");
}

// Include nested workspaces and the common JS, Python, Rust, Go, Ruby, PHP, JVM and .NET dependency inputs.
const dependencyInput = (file: string) => /^(?:package\.json|bun\.lockb?|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|deno\.jsonc?|deno\.lock|pyproject\.toml|uv\.lock|poetry\.lock|Pipfile(?:\.lock)?|requirements[^/]*\.txt|Cargo\.(?:toml|lock)|go\.(?:mod|sum)|Gemfile(?:\.lock)?|composer\.(?:json|lock)|pom\.xml|build\.gradle(?:\.kts)?|gradle\.lockfile|packages\.lock\.json|.*\.(?:csproj|fsproj))$/.test(basename(file));

/** Refresh dependencies introduced by the target's commits before any post-rebase gate runs. */
export function prepareLandingDependencies(cwd: string, before: string): void {
	const changed = git(cwd, "diff", "--name-only", "-z", before, "HEAD").split("\0");
	if (!changed.some(dependencyInput)) return;
	const tasks = JSON.parse(execFileSync("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8", stdio: "pipe" })) as { name: string }[];
	const task = tasks.some(t => t.name === "deps") ? "deps" : tasks.some(t => t.name === "setup") ? "setup" : undefined;
	if (task) execFileSync("mise", ["run", task], { cwd, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20, timeout: 30 * 60_000 });
}
