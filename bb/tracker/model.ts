// The issue model both sides share: no Node imports, so app.tsx can bundle it.

/** One issue as the views need it: a projection of an \`issues.ts snapshot --json\` row plus where it lives. */
export interface Issue {
	slug: string;
	/** Path relative to the project root. */
	path: string;
	archived: boolean;
	legacy: boolean;
	ownStage: string | null;
	effectiveStage: string | null;
	assignee: string | null;
	priority: number | null;
	partOf: string | null;
	blockedBy: string[];
	guards: string[];
	ready: boolean;
	eligible: boolean;
	frontier: boolean;
	done: boolean;
	deferred: boolean;
	blockers: string[];
	claims: string[];
}

export interface Snapshot { root: string; repo: string; issues: Issue[]; at: number }

export const MENTION_PROVIDER = "issue";
/** Mentions of a department, campaign or promise on the Campaigns page: \`<projectId>/<kind>:<key>\`. */
export const CAMPAIGN_MENTION = "campaign";
/** Realtime channel: an issue file changed under \`{ root }\`. */
export const CHANGED = "issues-changed";

export function stageLabel(i: Issue): string {
	if (i.legacy) return "legacy";
	const own = i.ownStage ?? "container";
	return i.effectiveStage && i.effectiveStage !== i.ownStage ? own + " → " + i.effectiveStage : own;
}

/** Why an issue can't go to a supervisor now, in the tracker's terms. Supervision takes the frontier: a ready subtree,
 * unblocked, unclaimed, assigned to an agent. */
export function notReady(i: Issue): string {
	if (i.done) return "done";
	if (i.legacy) return "legacy issue";
	if (!i.ready) return "needs refining (" + stageLabel(i) + ")";
	const why = [];
	if (i.blockers.length) why.push("blocked by " + i.blockers.join(", "));
	if (i.claims.length) why.push("claimed by " + i.claims.join(", "));
	if (!i.eligible) why.push("not assigned to an agent (" + (i.assignee ?? "unassigned") + ")");
	if (i.deferred) why.push("deferred");
	return why.join("; ") || "not on the frontier";
}

/** A slug read as a title: the filename is the issue's title. */
export const title = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");

// Campaigns: docs/departments.md (the maintainer's perspectives and each one's ranked campaigns) rendered over the
// tracker, git, the reconcilers and the repository's own facts command. Nothing here is stored; every count is computed.

export type Level = "ok" | "risk" | "broken" | "unknown";
export interface Bar { text: string; met: boolean }
export interface InFlight { slug: string; phase: string; threadId: string | null }
export interface CampaignView {
	/** department-slug/campaign-slug */
	key: string;
	rank: number;
	title: string;
	outcome: string;
	bars: Bar[];
	/** "ongoing" without bars, "done" with all met, else "n of m bars met". */
	state: string;
	/** The issues it tracks by name or pattern, and their subtrees. */
	roots: string[];
	members: string[];
	missing: string[];
	counts: { done: number; settled: number; idea: number };
	landedThisWeek: number;
	/** Last date a member's stage changed, within the history window. */
	moved: string | null;
	/** Members' stage changes on main in the last WEEKS weeks, oldest first. */
	activity: Activity[];
	inFlight: InFlight[];
}
export interface PromiseView { key: string; text: string; level: Level; note: string }
export interface DepartmentView { key: string; name: string; attention: string; promises: PromiseView[]; campaigns: CampaignView[]; notes: string[] }
export interface ReconcilerException { root: string; node: string; ownerThread: string | null }
export interface Campaigns {
	root: string;
	repo: string;
	/** docs/departments.md relative to root, or null when the project has none. */
	file: string | null;
	at: number;
	departments: DepartmentView[];
	/** Open issues no campaign tracks whose parent isn't open either. */
	loose: string[];
	exceptions: ReconcilerException[];
	/** Whether history (activity, moved, landed) is computed yet; the first read of a long log runs in the background. */
	history: boolean;
	facts: { at: number | null; error: string | null; command: string | null };
	/** The commits activity cites, by full hash. */
	commits: Record<string, CommitInfo>;
	/** The GitHub repository URL commits and ranges link under, or null. */
	commitUrl: string | null;
	/** Largest day and week totals of any campaign, so every chart shares one scale. */
	scale: { day: number; week: number };
}
/** A stage change of a tracked issue: reaching done, becoming a goal, spec or ticket, or being filed as an idea. */
export type ActivityKind = "done" | "settled" | "idea";
export interface Activity { date: string; slug: string; kind: ActivityKind; commit: string }
/** base: set when the commit landed a range (main fast-forwarded onto it from base). */
export interface CommitInfo { subject: string; date: string; pushed: boolean; base: string | null }
export const kindOf = (stage: string): ActivityKind | null =>
	stage === "done" ? "done" : stage === "idea" ? "idea" : ["goal", "spec", "ticket"].includes(stage) ? "settled" : null;
export const WEEKS = 12;
const DAY_MS = 86_400_000;
/** Midnight UTC of the Monday starting the chart's first week: WEEKS weeks ending with the current one. */
export function chartStart(now = Date.now()): number {
	const today = Math.floor(now / DAY_MS) * DAY_MS;
	const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS;
	return monday - (WEEKS - 1) * 7 * DAY_MS;
}
/** Week column (0 = oldest) of a YYYY-MM-DD date; negative before the chart. */
export const weekIndex = (date: string, now = Date.now()) => Math.floor((Date.parse(date) - chartStart(now)) / (7 * DAY_MS));
export const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
