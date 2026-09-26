// A session's working set: files it changed (git, against its branch base) plus files its tool
// calls named. Sessions here run tools through bash, so paths are recovered from command text:
// any token that resolves to an existing file inside the session's cwd counts. The set is laid
// out as a symlink mirror of the worktree, so any file tool (yazi, neo-tree) shows it as a tree.

import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, realpathSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { Node } from "./graph";
import { reviewBase } from "./actions";

export interface Touched { changed: string[]; named: string[] }

const inside = (root: string, p: string) => { const r = relative(root, p); return !!r && !r.startsWith("..") && !isAbsolute(r); };

function changed(cwd: string): string[] {
	const git = (...a: string[]) => { try { return execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean); } catch { return []; } };
	const base = reviewBase(cwd);
	return [...new Set([...(base ? git("diff", "--name-only", base) : []), ...git("diff", "--name-only", "HEAD"), ...git("ls-files", "--others", "--exclude-standard")])];
}

/** Paths named in the session's tool calls that are files under its cwd, most recent last. */
async function named(n: Node, root: string): Promise<string[]> {
	const seen = new Map<string, number>();
	let i = 0;
	const lines = createInterface({ input: createReadStream(n.file), crlfDelay: Infinity });
	for await (const line of lines) {
		if (!line.includes('"toolCall"')) continue;
		let e: any;
		try { e = JSON.parse(line); } catch { continue; }
		for (const part of e.message?.content ?? []) {
			if (part?.type !== "toolCall") continue;
			const args = part.arguments ?? {};
			const text = [args.command, args.path, args.file_path, args.file].filter(x => typeof x === "string").join(" ");
			let dir = n.cwd;
			const cd = /^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*(?:&&|;)/.exec(text);
			if (cd) dir = resolve(n.cwd, cd[1]!.replace(/^["']|["']$/g, ""));
			for (let token of text.split(/[\s"'`;|&()<>=,]+/)) {
				token = token.replace(/:\d+(-\d+)?$/, "").replace(/^[@]/, "");
				if (!token || token.startsWith("-") || token.includes("*") || token.length > 300) continue;
				for (const candidate of new Set([resolve(dir, token), resolve(n.cwd, token)])) {
					if (!inside(root, candidate) || candidate.includes("/node_modules/") || candidate.includes("/.git/")) continue;
					try { if (statSync(candidate).isFile()) seen.set(relative(root, candidate), i++); } catch {}
				}
			}
		}
	}
	return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([p]) => p);
}

export async function touched(n: Node): Promise<Touched> {
	const root = realpathSync(n.cwd);
	const c = changed(n.cwd);
	const set = new Set(c);
	return { changed: c, named: (await named({ ...n, cwd: root }, root)).filter(p => !set.has(p)) };
}

/** Mirror of the working set: changed files at their paths, other named files under _read/.
 * Links point at the real files, so opening one edits the worktree. */
export async function mirror(n: Node): Promise<{ dir: string; count: number }> {
	const t = await touched(n);
	const root = realpathSync(n.cwd);
	const dir = join(process.env.TMPDIR ?? tmpdir(), "ab-tree-files", n.id);
	rmSync(dir, { recursive: true, force: true });
	const link = (rel: string, at: string) => {
		const target = join(root, rel);
		if (!existsSync(target)) return; // deleted files stay in the diff, not here
		mkdirSync(dirname(at), { recursive: true });
		try { symlinkSync(target, at); } catch {}
	};
	for (const rel of t.changed) link(rel, join(dir, rel));
	for (const rel of t.named) link(rel, join(dir, "_read", rel));
	mkdirSync(dir, { recursive: true });
	return { dir, count: t.changed.length + t.named.length };
}
