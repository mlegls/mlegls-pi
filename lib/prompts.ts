// Search what the user wrote, across harnesses: pi sessions, Claude Code project transcripts and
// Claude Code's prompt history (which outlives its transcripts). Skill bodies, dispatched worker
// assignments and other generated preambles are skipped, so matches are the user's own words.
//   ab lib prompts search 'persona|shaft' '{"project":"mmon/design"}'
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Prompt { source: "pi" | "claude" | "history"; project: string; at: string; text: string; file?: string }
export interface SearchOptions { project?: string; since?: string; limit?: number; max?: number }

const H = homedir();
const PI = join(H, ".pi/agent/sessions");
const CLAUDE = join(H, ".claude/projects");
const HISTORY = join(H, ".claude/history.jsonl");

/** Generated text that arrives in the user role: skills, worker assignments, harness notices. */
const GENERATED = /^\s*(<|#|---\n|\[h\d+ |Hacking session|Auditing session|You are |Verify |Implement |Advance )/;

function* jsonl(file: string) {
	let body: string;
	try { body = readFileSync(file, "utf8"); } catch { return; }
	for (const line of body.split("\n")) { if (!line) continue; try { yield JSON.parse(line); } catch {} }
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n");
	return "";
}

function* files(root: string, keep: (dir: string) => boolean): Generator<[string, string]> {
	if (!existsSync(root)) return;
	for (const dir of readdirSync(root)) {
		if (!keep(dir)) continue;
		const full = join(root, dir);
		if (!statSync(full).isDirectory()) continue;
		for (const f of readdirSync(full)) if (f.endsWith(".jsonl")) yield [dir, join(full, f)];
	}
}

/** Every user-authored prompt, newest first, optionally narrowed to projects whose path contains `project`. */
export function all(opts: SearchOptions = {}): Prompt[] {
	const want = (p: string) => !opts.project || p.toLowerCase().includes(opts.project.toLowerCase().replace(/\//g, "-"))
		|| p.toLowerCase().includes(opts.project.toLowerCase());
	const out: Prompt[] = [];
	const push = (p: Prompt) => { if (p.text.length >= 12 && !GENERATED.test(p.text) && (!opts.since || p.at >= opts.since)) out.push(p); };
	for (const [dir, file] of files(PI, want)) for (const o of jsonl(file)) {
		if (o.type === "message" && o.message?.role === "user") push({ source: "pi", project: dir, at: String(o.timestamp ?? ""), text: textOf(o.message.content), file });
	}
	for (const [dir, file] of files(CLAUDE, want)) for (const o of jsonl(file)) {
		if (o.type === "user" && o.message?.role === "user" && !o.isMeta) push({ source: "claude", project: dir, at: String(o.timestamp ?? ""), text: textOf(o.message.content), file });
	}
	for (const o of jsonl(HISTORY)) {
		if (typeof o.display !== "string" || o.display.startsWith("/") || !want(String(o.project ?? ""))) continue;
		push({ source: "history", project: String(o.project), at: new Date(o.timestamp ?? 0).toISOString(), text: o.display });
	}
	const seen = new Set<string>();
	return out.sort((a, b) => b.at.localeCompare(a.at)).filter(p => { const k = p.text.slice(0, 400); return !seen.has(k) && !!seen.add(k); });
}

/** Prompts matching a case-insensitive regex, rendered for reading. */
export function search(pattern: string, opts: SearchOptions = {}) {
	const re = new RegExp(pattern, "i");
	const hits = all(opts).filter(p => re.test(p.text)).slice(0, opts.limit ?? 40);
	const max = opts.max ?? 2500;
	return {
		hits,
		render: () => hits.map(p => `===== ${p.at.slice(0, 16)} ${p.source} ${p.project.slice(0, 70)}\n${p.text.length > max ? p.text.slice(0, max) + " …" : p.text}`).join("\n\n") || "no matches",
	};
}
