import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Fields, Stage, TrackerOptions } from "./tracker.ts";
import { git } from "./thread/git.ts";
import { requireGithub, type GithubProject, type GithubSnapshot, type GithubIssue } from "./tracker-github-snapshot.ts";
import type { GlobalRunState } from "./reconcile/tracker-state.ts";

export interface GithubReceipt {
	stage?: Stage | null;
	claim?: { claimedBy: string; assigneeId: string };
	removed?: boolean;
	removing?: { parent: string | null };
}
export interface CreationIntent {
	marker: string;
	request: string;
	fields: Fields;
	body: string;
	claim?: GithubReceipt["claim"];
	parentId?: string;
	slug?: string;
	published?: boolean;
	publishing?: boolean;
	done?: boolean;
}
export interface GithubJournal {
	version: 1;
	repository: string;
	issues: Record<string, GithubReceipt>;
	creates: Record<string, CreationIntent>;
	updates: Record<string, { fields: Fields; body?: string; claim?: GithubReceipt["claim"] }>;
	closes: Record<string, { marker: string; body: string; done?: boolean }>;
	removes: Record<string, { claim: NonNullable<GithubReceipt["claim"]>; parent: string | null; done?: boolean }>;
	moves: Record<string, { marker: string; body: string; done?: boolean }>;
}
export const reconcileDirectory = (project: GithubProject) => dirname(dirname(project.directory));
const identity = (project: GithubProject) => project.host + "/" + project.repository.toLowerCase();
export const journalFile = (project: GithubProject, root?: string) => root
	? join(reconcileDirectory(project), root + ".github.json") : join(project.directory, "private.json");

export function loadJournal(project: GithubProject, root?: string): GithubJournal {
	const file = journalFile(project, root);
	if (!existsSync(file)) return { version: 1, repository: identity(project), issues: {}, creates: {}, updates: {}, closes: {}, removes: {}, moves: {} };
	const value = JSON.parse(readFileSync(file, "utf8")) as GithubJournal;
	requireGithub(value.version === 1 && value.repository === identity(project), "private journal repository mismatch: " + file);
	return value;
}
/** Call only under the repository SQLite lock. Never write the reconciler's run JSON. */
export function saveJournal(project: GithubProject, journal: GithubJournal, root?: string): void {
	const file = journalFile(project, root), tmp = file + "." + randomUUID() + ".tmp";
	mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
	try { writeFileSync(tmp, JSON.stringify(journal), { mode: 0o600 }); renameSync(tmp, file); }
	finally { if (existsSync(tmp)) unlinkSync(tmp); }
}

export function runAuthority(project: GithubProject, options: TrackerOptions): GlobalRunState | undefined {
	const root = options.run ?? process.env.PI_WM_RUN;
	if (!root) return undefined;
	requireGithub(/^[a-z0-9][a-z0-9-]*$/.test(root), "run must be an exact reconciler root, not a claim token");
	const file = join(reconcileDirectory(project), root + ".json");
	requireGithub(existsSync(file), "no saved run authority for " + root);
	const state = JSON.parse(readFileSync(file, "utf8")) as GlobalRunState & { backend: string };
	requireGithub(state.backend === "threads" && state.root === root && state.refinements
		&& git(state.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir") === git(project.cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"),
		"saved run does not belong to this repository: " + root);
	return state;
}

export function decodeGithubBody(body: string): { fields: Fields; body: string; marker?: string } {
	const match = body.match(/(?:^|\n)<!-- mlegls-pi:tracker\n([\s\S]*?)\n-->\s*$/);
	if (!match) return { fields: {}, body };
	let value: unknown;
	try { value = JSON.parse(match[1]!); } catch { throw new Error("GitHub tracker: malformed adapter metadata"); }
	requireGithub(value && typeof value === "object" && !Array.isArray(value), "adapter metadata must be an object");
	const fields = { ...value as Fields };
	const marker = typeof fields.$correlation === "string" ? fields.$correlation : undefined;
	delete fields.$correlation;
	// Ownership never comes from a remote body, even a hand-edited envelope.
	delete fields["claimed-by"];
	return { fields, marker, body: body.slice(0, match.index) };
}
export function encodeGithubBody(body: string, fields: Fields, marker?: string): string {
	requireGithub(!/<!-- mlegls-pi:tracker(?:\n|$)/.test(body), "replacement body contains reserved adapter envelope");
	// "<" and ">" only occur inside JSON strings: escape them so a value containing "-->" cannot end the HTML comment early.
	const json = JSON.stringify({ ...fields, ...(marker ? { $correlation: marker } : {}) }).replace(/[<>]/g, char => char === "<" ? "\\u003c" : "\\u003e");
	return body + "\n<!-- mlegls-pi:tracker\n" + json + "\n-->";
}

/** Pending create intents are already exact receipts: the random marker, parent,
 * native assignment and repository must ALL agree. No title/login heuristic.
 * This read-only projection also covers a process dying before saving the response. */
export function readGithubReceipt(project: GithubProject, snapshot: GithubSnapshot, issue: GithubIssue): GithubReceipt | undefined {
	const slug = "gh-" + issue.number;
	const shared = loadJournal(project);
	let base = shared.issues[slug];
	let claim = base?.claim;
	const marker = decodeGithubBody(issue.body).marker;
	const directory = reconcileDirectory(project);
	const journals = [shared, ...(existsSync(directory) ? readdirSync(directory).filter(file => file.endsWith(".github.json")).map(file => JSON.parse(readFileSync(join(directory, file), "utf8")) as GithubJournal) : [])];
	for (const raw of journals) {
		if (raw.repository !== identity(project)) continue;
		const receipt = raw.issues[slug];
		const removal = raw.removes[slug];
		if (removal && !removal.done) {
			const finished = issue.state === "CLOSED" && issue.stateReason === "NOT_PLANNED" && !issue.parent
				&& !issue.blockedBy.some(edge => edge.repository.id === snapshot.repository.id)
				&& !issue.assignees.some(user => user.id === removal.claim.assigneeId);
			base = { ...base, ...(finished ? { removed: true } : { removing: { parent: removal.parent } }) };
		}
		const pending = raw.updates[slug]?.claim;
		if (pending && issue.assignees.some(user => user.id === pending.assigneeId)) claim = pending;
		if (receipt?.claim && !pending) {
			requireGithub(!claim || claim.claimedBy === receipt.claim.claimedBy, slug + ": contradictory private ownership");
			claim = receipt.claim;
		}
		for (const intent of Object.values(raw.creates)) if (marker && intent.marker === marker && !receipt?.removed) {
			// A completed intent is not residual authority after release/transfer.
			if (intent.published) continue;
			if (Object.hasOwn(intent.fields, "stage")) base = { ...base, stage: intent.fields.stage as GithubReceipt["stage"] };
			if (!intent.claim) continue;
			requireGithub(issue.parent?.id === intent.parentId && issue.assignees.some(user => user.id === intent.claim!.assigneeId),
				slug + ": pending creation marker has changed parent/assignment");
			requireGithub(!claim || claim.claimedBy === intent.claim.claimedBy, slug + ": conflicting pending create ownership");
			claim = intent.claim;
		}
	}
	if (claim && !issue.assignees.some(user => user.id === claim!.assigneeId)) claim = undefined;
	return base || claim ? { ...base, ...(claim ? { claim } : { claim: undefined }) } : undefined;
}
