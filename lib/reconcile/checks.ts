// Mechanical checks the reconciler applies to worker handoffs and integrations, carried over from the
// prototype's supervise loop (lib/jobs/supervise.ts at the prototype tag): the integration gate, story and
// evidence shapes, and closing an issue on the branch that lands it.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The project's integration gate: a mise task it declares as a lifecycle point, like its worktree post_create hook.
 * `pre-integrate` runs on every landing (capped at 30 min, since the integrate lock serializes landings).
 * Checks too heavy for every landing (a full browser batch) run after it, by the project: see `mainRed`.
 * Reviewer-listed tests run beside the gate, never instead.
 * The gates are the one place a ticket runs the full suite: workers run the project's `test:affected` task against their base. */
export const declaredGates = (cwd: string): { cmd: string; timeout: number }[] => {
  let names: Set<string>;
  try { names = new Set((JSON.parse(execFileSync("mise", ["tasks", "ls", "--json"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as { name: string }[]).map(t => t.name)); }
  catch { return []; }
  return names.has("pre-integrate") ? [{ cmd: "mise run pre-integrate", timeout: 30 * 60_000 }] : [];
};
/** A project that verifies main after landing (concept: .husky/post-merge → scripts/verify-main.sh) keeps
 * `<git-common-dir>/verify-main/red` while main is red, naming the commit, the range landed since green and the log.
 * Landings into the owner's checkout wait for green; landings into collectors don't. */
export function mainRed(cwd: string): string | undefined {
  const file = join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "verify-main", "red");
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}
// Tests encoding the driver's checks (written by the reviewer; older drivers wrote their own): the integration gate runs them on the reviewer's final head.
// Handoff `tests` name committed test files (repository-relative); anything else (prose, commands) is not run.
export const testCommands = (h: Record<string, unknown> | null | undefined): string[] => Array.isArray(h?.tests) ? h.tests.filter((t): t is string => typeof t === "string" && /^[\w./-]+$/.test(t.trim()) && !t.includes("..")).map(t => t.trim()) : [];
// How the gate runs one test file; files that no longer exist (tidied away) are skipped.
export function testRun(cwd: string, file: string): string[] | null {
 const full = resolve(cwd, file);
 if (!existsSync(full) || !statSync(full).isFile()) return null;
 if (/\.test\.[cm]?[jt]sx?$/.test(file)) return ["bun", "test", "./" + file];
 if (statSync(full).mode & 0o111) return ["./" + file];
 if (file.endsWith(".sh")) return ["sh", file];
 return null;
}
// Unknown, empty, or prose-only outcomes are not acceptance.
export const unheld = (h: Record<string, unknown> | null) => !Array.isArray(h?.stories) || !h.stories.length || h.stories.some(s => !s || typeof s.story !== "string" || !s.story.trim() || s.outcome !== "held");
export const storyShapeError = (h: Record<string, unknown> | null, allowEmpty = false): string | null => {
 const stories = h?.stories;
 if (!Array.isArray(stories)) return "stories is missing or is not a list; expected stories: [{story: ..., outcome: held|failed|unobservable}]";
 if (!stories.length && !allowEmpty) return "stories is empty; expected one {story, outcome} entry per required story";
 for (let i = 0; i < stories.length; i++) {
  const story = stories[i];
  if (!story || typeof story !== "object" || Array.isArray(story)) return `stories[${i}] is a ${story === null ? "null" : typeof story}; expected {story, outcome}`;
  if (typeof story.story !== "string" || !story.story.trim()) return `stories[${i}].story is missing or not a string; expected {story, outcome}`;
  if (!( ["held", "failed", "unobservable"] as unknown[]).includes(story.outcome)) return `stories[${i}].outcome is ${JSON.stringify(story.outcome)}; expected held, failed, or unobservable`;
 }
 return null;
};
export const evidenceShapeError = (h: Record<string, unknown> | null): string | null => {
 const evidence = h?.evidence;
 if (evidence === undefined) return "evidence is missing; expected {path, visual, shots}";
 if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) return `evidence is ${evidence === null ? "null" : "a " + typeof evidence}; expected {path, visual, shots}`;
 const item = evidence as Record<string, unknown>;
 if (typeof item.path !== "string" || !item.path.trim()) return "evidence.path is missing or not a string; expected a committed Markdown index path";
 if (typeof item.visual !== "boolean") return "evidence.visual is missing or not a boolean";
 if (!Array.isArray(item.shots) || item.shots.some((shot: unknown) => typeof shot !== "string")) return "evidence.shots is missing or is not a list of image paths";
 if (item.visual && !item.shots.length) return "evidence.shots is empty but evidence.visual is true; expected committed image paths";
 if (!item.visual && item.shots.length) return "evidence.shots must be [] when evidence.visual is false";
 return null;
};
export function evidencePacket(cwd: string, handoff: Record<string, unknown> | null) {
 const e = handoff?.evidence as { path?: unknown; visual?: unknown; shots?: unknown } | undefined;
 if (!e || typeof e.visual !== "boolean" || !Array.isArray(e.shots) || (e.visual && !e.shots.length) || (!e.visual && e.shots.length)) throw new Error("Evidence needs path, visual boolean, and shots (nonempty for visual journeys)");
 const tracked = (p: unknown) => {
  if (typeof p !== "string" || !p.startsWith("docs/attachments/") || p.split("/").includes("..")) throw new Error("Evidence must live under docs/attachments: " + p);
  const full = resolve(cwd, p);
  if (!existsSync(full) || !realpathSync(full).startsWith(realpathSync(cwd) + "/")) throw new Error("Missing or external evidence: " + p);
  git(cwd, "cat-file", "-e", "HEAD:" + p);
  return p;
 };
 const path = tracked(e.path);
 if (!path.endsWith(".md")) throw new Error("Evidence index must be Markdown");
 const shots = e.shots.map(tracked);
 if (shots.some(p => !/\.(png|jpe?g|webp)$/i.test(p))) throw new Error("Shots must name image files, not directories");
 return { path, visual: e.visual, shots };
}

/** Mark an issue done on the branch that lands it, linking its verification evidence. */
export function close(cwd: string, file: string, slug: string, evidence?: string) {
	if (!existsSync(file)) throw new Error("Missing issue " + slug + " in " + cwd);
	const text = readFileSync(file, "utf8");
	if (/^stage: done$/m.test(text)) return;
	git(cwd, "ls-files", "--error-unmatch", "--", file);
	let body = text.replace(/^stage: \w+$/m, "stage: done");
	if (evidence) body = body.trimEnd() + "\n\n## Verification evidence\n\n[Encounter and evidence](" + relative(realpathSync(dirname(file)), realpathSync(resolve(cwd, evidence))) + ").\n";
	writeFileSync(file, body);
	git(cwd, "commit", "-qm", "Close " + slug, "--", file);
}
