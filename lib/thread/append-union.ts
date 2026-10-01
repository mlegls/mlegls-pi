import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitAttempt } from "./lifecycle-git";


/** Tracker issues (docs/issues/**.md) collect observations appended by parallel siblings; when both sides only
 * added lines at the same place in the body, keep both, ours first. Returns null for any other conflict: a hunk
 * that changed base lines, or one inside the frontmatter. Expects diff3 conflict markers. */
export function appendUnion(text: string): string | null {
  const lines = text.split("\n");
  const fmEnd = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("<<<<<<< ") && lines[i] !== "<<<<<<<") { out.push(lines[i]); continue; }
    if (i <= fmEnd) return null;
    const base = lines.findIndex((l, j) => j > i && l.startsWith("|||||||"));
    const mid = lines.findIndex((l, j) => j > base && l === "=======");
    const end = lines.findIndex((l, j) => j > mid && l.startsWith(">>>>>>>"));
    if (base < 0 || mid < 0 || end < 0 || mid !== base + 1) return null;
    out.push(...lines.slice(i + 1, base), ...lines.slice(mid + 1, end));
    i = end;
  }
  return out.join("\n");
}
export const trackerFile = (f: string) => /^docs\/issues\/.+\.md$/.test(f);

/** Settle a stopped rebase or merge whose conflicts are all tracker appends; false leaves it for the caller to abort. */
export async function settleAppends(dir: string, op: "rebase" | "merge"): Promise<boolean> {
	for (;;) {
		const files = (await gitAttempt(dir, "diff", "--name-only", "--diff-filter=U")).out.split("\n").filter(Boolean);
		if (!files.length || !files.every(trackerFile)) return false;
		for (const f of files) {
			const merged = appendUnion(readFileSync(join(dir, f), "utf8"));
			if (merged === null) return false;
			writeFileSync(join(dir, f), merged);
		}
		await gitAttempt(dir, "add", "--", ...files);
		const next = op === "rebase" ? await gitAttempt(dir, "-c", "core.editor=true", "rebase", "--continue") : await gitAttempt(dir, "commit", "--no-edit", "--no-verify");
		if (!next.code) return true;
	}
}
