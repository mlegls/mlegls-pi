import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { git } from "./checks";

/** Write a tree without changing refs, the index or either checkout. */
export function mergeTree(cwd: string, target: string, head: string, strategy?: "theirs"): { tree: string } | { files: string[] } {
	let output: string;
	try {
		return { tree: git(cwd, "merge-tree", "--write-tree", "--name-only", "-z", ...(strategy ? ["-X", strategy] : []), target, head).split("\0")[0] };
	} catch (e: any) {
		// Exit 1 means conflicts; other failures (unsupported Git, missing refs) must not look like a clean probe.
		if (e.status !== 1) throw e;
		output = String(e.stdout);
	}
	// With -z, the tree is followed by conflicted paths, an empty field, then informational messages.
	const files = output.split("\0").slice(1);
	const end = files.indexOf("");
	if (end < 0) throw new Error("Invalid merge-tree conflict output");
	return { files: files.slice(0, end) };
}

/** Probe without changing either checkout; the caller holds the integration lock. */
export function landingConflict(cwd: string, target: string, head: string): string | undefined {
	const merge = mergeTree(cwd, target, head);
	if ("files" in merge) return conflictDetails(cwd, target, git(cwd, "merge-base", target, head), merge.files);
}

export function conflictDetails(cwd: string, target: string, base: string, files: string[]): string {
	return "merge conflict against " + target + "\n" + files.map(file =>
		"\n" + file + "\n" + (git(cwd, "log", "--oneline", base + ".." + target, "--", file) || "(no target commits since merge base)")
	).join("\n");
}

// Include nested workspaces and the common JS, Python, Rust, Go, Ruby, PHP, JVM and .NET dependency inputs.
const dependencyInput = (file: string) => /^(?:package\.json|bun\.lockb?|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|deno\.jsonc?|deno\.lock|pyproject\.toml|uv\.lock|poetry\.lock|Pipfile(?:\.lock)?|requirements[^/]*\.txt|Cargo\.(?:toml|lock)|go\.(?:mod|sum)|Gemfile(?:\.lock)?|composer\.(?:json|lock)|pom\.xml|build\.gradle(?:\.kts)?|gradle\.lockfile|packages\.lock\.json|.*\.(?:csproj|fsproj))$/.test(basename(file));

export type LandingRepair = {
	kind: "conflict" | "format" | "lint" | "typecheck";
	target: string;
	reviewed: string;
	base: string;
	files?: string[];
	targetFiles?: string[];
};

export const changedFiles = (cwd: string, from: string, to: string) =>
	git(cwd, "diff", "--name-only", "--no-renames", "-z", from, to).split("\0").filter(Boolean);

function lineRanges(cwd: string, from: string, to: string, file: string, side: 1 | 3): [number, number][] {
	const diff = git(cwd, "--literal-pathspecs", "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "-U0", from, to, "--", file);
	const ranges = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(m => {
		const first = Number(m[side]), size = Number(m[side + 1] ?? 1);
		// A deletion/insertion has a boundary rather than a line on this side.
		return [first, first + Math.max(0, size - 1)] as [number, number];
	});
	return diff && !ranges.length ? [[0, Infinity]] : ranges;
}

/** Classify the failed gate, never setup failures or retained tests. Unknown output stays with review. */
export function gateRepair(cwd: string, target: string, reviewed: string, base: string, log: string): LandingRepair | undefined {
	const output = log.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
	const format = /Format(?:ting)? issues found in above|Code formatting issues found|Checking formatting[\s\S]*Code style issues|would reformat|(?:script|task) ["'\x60]?(?:format(?::check)?|fmt(?::check)?)["'\x60]?(?:\s+exited|\s+failed)/i.test(output);
	if (format) {
		const paths = output.split("\n").map(line => line.trim().replace(/^\[warn\]\s+|^would reformat\s+/g, "").replace(/^\.\//, "").replace(/\s+\(\d+(?:\.\d+)?ms\)$/, ""));
		const names = new Set(git(cwd, "ls-tree", "-r", "--name-only", "-z", base).split("\0").filter(Boolean));
		const files = [...new Set(paths.filter(p => names.has(p)))];
		// Only a file the node left alone is certainly wrong on the target; one it changed is formatted on its own branch.
		const inherited = new Set(git(cwd, "ls-tree", "-r", "--name-only", "-z", target).split("\0"));
		const own = new Set(changedFiles(cwd, target, base));
		return { kind: "format", target, reviewed, base, files, targetFiles: files.filter(file => inherited.has(file) && !own.has(file)) };
	}
	if (/(?:script|task) ["'\x60]?(?:[\w-]*lint)(?::[\w-]+)?["'\x60]?(?:\s+exited|\s+failed)|\bESLint\b.+(?:problems|errors)|\bFound \d+ warnings? and [1-9]\d* errors?\b/i.test(output))
		return { kind: "lint", target, reviewed, base };
	const diagnostics = [...output.matchAll(/^\s*(.+?)(?:\((\d+),\d+\)|:(\d+):\d+)\s*(?::|-)\s*error TS\d+:/gm)];
	if (!diagnostics.length) return;
	const own = changedFiles(cwd, target, base);
	const names = git(cwd, "ls-tree", "-r", "--name-only", "-z", base).split("\0");
	if (diagnostics.every(([, file, paren, colon]) => {
		file = file.replace(cwd + "/", "").replace(/^\.\//, "");
		const matches = names.filter(p => p && (p === file || p.endsWith("/" + file)));
		const line = Number(paren ?? colon);
		return matches.length === 1 && (!own.includes(matches[0]) || !lineRanges(cwd, target, base, matches[0], 3).some(([a, b]) => a <= line && line <= b));
	})) return { kind: "typecheck", target, reviewed, base };
}

/** Compare against Git's mechanical update preserving the reviewed side of conflicting hunks. */
export function repairNeedsReview(cwd: string, repair: LandingRepair, head: string, formatOnly: boolean): boolean {
	let reference = repair.base;
	if (repair.kind === "conflict") {
		try {
			const merge = mergeTree(cwd, repair.target, repair.reviewed, "theirs");
			if ("files" in merge) return true;
			reference = merge.tree;
		} catch { return true; } // Git without merge-tree strategy options cannot certify this resolution.
	}
	const changed = changedFiles(cwd, reference, head);
	if (repair.kind === "format" && formatOnly && changed.every(file => !repair.files?.length || repair.files.includes(file))) return false;
	const own = new Set(changedFiles(cwd, repair.target, reference));
	return changed.some(file => {
		if (!own.has(file)) return false;
		const reviewed = lineRanges(cwd, repair.target, reference, file, 3);
		return lineRanges(cwd, reference, head, file, 1).some(([a, b]) => reviewed.some(([c, d]) => a <= d && c <= b));
	});
}

/** Refresh dependencies introduced by the target's commits before any post-rebase gate runs. */
export function prepareLandingDependencies(cwd: string, before: string): void {
	const changed = git(cwd, "diff", "--name-only", "-z", before, "HEAD").split("\0");
	if (!changed.some(dependencyInput)) return;
	const tasks = JSON.parse(execFileSync("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8", stdio: "pipe" })) as { name: string }[];
	const task = tasks.some(t => t.name === "deps") ? "deps" : tasks.some(t => t.name === "setup") ? "setup" : undefined;
	if (task) execFileSync("mise", ["run", task], { cwd, encoding: "utf8", stdio: "pipe", maxBuffer: 64 << 20, timeout: 30 * 60_000 });
}
