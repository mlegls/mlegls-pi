// Disposable protocol probe: ordinary Bun script, never imported by a test suite.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Issue, Stage } from "../../../lib/tracker.ts";
import { schedulingView, type ScheduledIssue, type SchedulingContext } from "../../../lib/reconcile/scheduling.ts";
import type { LandingLedger } from "../../../lib/reconcile/tracker-state.ts";

const checkout = resolve(import.meta.dir, "../../..");
const cli = join(checkout, "skills/enabled/all/mlegls/conventions/tracker/scripts/issues.ts");
const vault = mkdtempSync(join(tmpdir(), "projection-probe-"));
const cwd = join(vault, "projects/projection");
const issues = join(cwd, "issues");
mkdirSync(issues, { recursive: true });
const env: NodeJS.ProcessEnv = {
	...process.env,
	TRACKER_CLI: cli, TRACKER_VAULT: vault, TRACKER_NO_INFLIGHT: "1",
	PI_BOARD_DIR: join(vault, "board"), XDG_STATE_HOME: join(vault, "state"),
	XDG_CACHE_HOME: join(vault, "cache"), PI_CODING_AGENT_DIR: join(vault, "agent"),
	ZMX_DIR: join(vault, "zmx"),
};
for (const key of Object.keys(env)) if (/^(BB_|PI_SESSION|PI_THREAD|AB_|WM_)/.test(key)) delete env[key];
const run = (args: string[], input?: string) => execFileSync("bun", [cli, ...args], {
	cwd, env, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
});

type Seed = {
	slug: string; stage?: Stage; partOf?: string; assignee?: string;
	priority?: number; blockedBy?: string[]; guards?: string[]; claim?: string; archived?: boolean;
};
const seeds: Seed[] = [
	{ slug: "root", stage: "spec", assignee: "agent" },
	{ slug: "a", stage: "ticket", partOf: "root", assignee: "agent", claim: "reconcile:root" },
	{ slug: "b", stage: "ticket", partOf: "root", assignee: "agent:technical", blockedBy: ["a", "finished", "archive"] },
	{ slug: "outside", stage: "ticket", assignee: "agent", blockedBy: ["a"] },
	{ slug: "omitted" },
	{ slug: "omitted-child", stage: "ticket", partOf: "omitted", assignee: "agent" },
	{ slug: "residual", stage: "spec", assignee: "agent" },
	{ slug: "human", stage: "ticket", partOf: "residual", assignee: "human", priority: 4, claim: "session:foreign" },
	{ slug: "deferred", stage: "spec", assignee: "agent" },
	{ slug: "deferred-child", stage: "ticket", partOf: "deferred", assignee: "model:local/fixture:high", priority: 4 },
	{ slug: "guarded", stage: "spec", assignee: "agent" },
	{ slug: "guard-child", stage: "ticket", partOf: "guarded", assignee: "agent",
		blockedBy: ["a", "missing"], guards: ["spec: [[projects/projection/issues/a]]", "after: guard-child"] },
	{ slug: "provisional", stage: "spec", assignee: "agent" },
	{ slug: "provisional-child", stage: "spec", partOf: "provisional", assignee: "agent", claim: "reconcile:root/refine-active" },
	{ slug: "lookalike", stage: "ticket", assignee: "agent", claim: "reconcile:root/refine-unrecorded" },
	{ slug: "own-done", stage: "done", assignee: "human" },
	{ slug: "unfinished", stage: "ticket", partOf: "own-done", assignee: "agent" },
	{ slug: "finished", stage: "done", assignee: "human", priority: 4, claim: "session:finished-foreign" },
	{ slug: "archive", stage: "done", partOf: "root", assignee: "human", priority: 4, claim: "session:archived", archived: true },
	{ slug: "lower", stage: "spec", assignee: "agent" },
	{ slug: "goal", stage: "goal", partOf: "lower", assignee: "agent" },
	{ slug: "idea", stage: "idea", partOf: "goal", assignee: "agent" },
];
const descendants = (seed: Seed): Seed[] => [seed, ...seeds.filter(child => child.partOf === seed.slug && !child.archived).flatMap(descendants)];
// These intentionally start with stale stage/readiness/selectors/blockers rollups.
// Only canonical done and stored claims have to be accurate in the incoming DTO.
const global = new Map<string, Issue>(seeds.map(seed => [seed.slug, {
	slug: seed.slug, archived: !!seed.archived, ownStage: seed.stage ?? null,
	effectiveStage: null, partOf: seed.partOf ?? null, assignee: seed.assignee ?? null,
	author: "user:projection-probe", priority: seed.priority ?? null,
	blockedBy: seed.blockedBy ?? [], guards: seed.guards ?? [],
	done: !seed.archived && seed.stage === "done" && !seeds.some(child => child.partOf === seed.slug && !child.archived),
	ready: false, eligible: false, frontier: false, deferred: false, selectors: [],
	claims: descendants(seed).filter(node => !node.archived && node.claim)
		.map(node => ({ slug: node.slug, claimedBy: node.claim! })),
	// The actual CLI has an undeclared rolled-up blockers field. Never use it as input.
	blockers: ["stale-rollup"],
}]));
function freeze(value: unknown): void {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
	for (const child of Object.values(value)) freeze(child);
	Object.freeze(value);
}
for (const row of global.values()) freeze(row);
const input = JSON.stringify([...global]);
const normalize = (row: Issue & { blockers?: string[] }) => ({
	ownStage: row.ownStage, effectiveStage: row.effectiveStage, done: row.done,
	ready: row.ready, eligible: row.eligible, frontier: row.frontier, deferred: row.deferred,
	blockers: [...row.blockers ?? []].sort(),
	claims: [...row.claims].sort((a, b) => a.slug.localeCompare(b.slug) || a.claimedBy.localeCompare(b.claimedBy)),
	selectors: [...row.selectors].sort((a, b) => a.slug.localeCompare(b.slug)),
});
const show = (label: string, view: Map<string, ScheduledIssue>, slugs: string[]) => {
	console.log(label);
	for (const slug of slugs) {
		const row = view.get(slug)!;
		console.log(JSON.stringify({ slug, ...normalize(row), satisfied: row.satisfied, provisional: row.provisional }));
	}
};
const context: SchedulingContext = {
	root: "root", into: "root", landed: {}, attemptClaims: new Set(["reconcile:root/refine-active"]),
	withheld: new Set(["provisional-child"]),
};
const land = (into: string): LandingLedger => Object.fromEntries(
	["a", "omitted-child", "human", "deferred-child"].map(slug => [slug, {
		into, head: "fixture-code-head", at: "2026-10-12T00:00:00.000Z",
	}]),
);
try {
	// Use the actual write API with explicit provenance. Create no-residual parents
	// temporarily as tickets; remove their stage only after attaching their child.
	for (const seed of seeds) run(["create", seed.slug, "--fields", JSON.stringify({
		stage: seed.stage ?? "ticket", author: "user:projection-probe",
		...(seed.assignee ? { assignee: seed.assignee } : {}),
		...(seed.partOf ? { "part-of": seed.partOf } : {}),
		...(seed.priority ? { priority: seed.priority } : {}),
		...(seed.claim ? { "claimed-by": seed.claim } : {}),
		...((seed.blockedBy?.length || seed.guards?.length) ? { "blocked-by": [...seed.blockedBy ?? [], ...seed.guards ?? []] } : {}),
	}), "--body-file", "-"], "Isolated disposable projection seed.\n");
	for (const seed of seeds.filter(seed => !seed.stage)) run(["update", seed.slug, "--fields", '{"stage":null}']);
	mkdirSync(join(issues, "archive"));
	renameSync(join(issues, "archive.md"), join(issues, "archive/archive.md"));
	const canonical = JSON.parse(run(["snapshot", "--json"])).issues as (Issue & { blockers: string[] })[];
	const empty = schedulingView(global, { ...context, root: "empty-run", landed: {}, attemptClaims: new Set(), withheld: new Set() });
	assert.equal(empty.size, canonical.length);
	for (const row of canonical) assert.deepEqual(normalize(empty.get(row.slug)!), normalize(row), row.slug);
	console.log("Empty-overlay CLI parity: " + canonical.length + " rows (stages/readiness/eligibility/frontier/blockers/claims/selectors/deferred/done).");
	show("Empty overlay (selected rows)", empty, ["root", "a", "b", "omitted", "own-done", "lower", "goal", "finished", "archive"]);

	const ledger = land("root");
	freeze(ledger);
	const local = schedulingView(global, { ...context, landed: ledger });
	const other = schedulingView(global, { ...context, into: "other-collector", landed: ledger });
	const owner = schedulingView(global, { ...context, into: cwd, landed: ledger });
	assert.equal(local.get("finished")!.satisfied, true);
	assert.equal(local.get("archive")!.satisfied, true);
	assert.equal(local.get("archive")!.done, false);
	assert.equal(local.get("a")!.done, false);
	assert.equal(local.get("a")!.satisfied, true);
	assert.equal(local.get("b")!.frontier, true);
	assert.equal(other.get("b")!.frontier, false);
	assert.equal(owner.get("outside")!.frontier, false);
	assert.deepEqual(owner.get("outside")!.blockers, ["a"]);
	assert.equal(local.get("root")!.frontier, true); // The internal b -> a edge never blocks root.
	assert.deepEqual(local.get("guarded")!.blockers, ["missing", "spec: [[projects/projection/issues/a]]", "after: guard-child"]);
	assert.equal(local.get("omitted")!.satisfied, true);
	assert.equal(local.get("omitted")!.ownStage, null);
	assert.deepEqual(local.get("omitted")!.selectors, []);
	assert.equal(local.get("residual")!.eligible, true); // Landed human no longer constrains assignment.
	assert.equal(local.get("residual")!.deferred, false);
	assert.deepEqual(local.get("residual")!.selectors, [{ slug: "residual", assignee: "agent" }]);
	assert.deepEqual(local.get("residual")!.claims, [{ slug: "human", claimedBy: "session:foreign" }]);
	assert.equal(local.get("residual")!.frontier, false); // Foreign claims still reserve a satisfied child.
	assert.equal(local.get("deferred")!.frontier, true);
	assert.equal(empty.get("deferred")!.frontier, false);
	const explicit = schedulingView(global, { ...context, explicit: true });
	assert.equal(explicit.get("deferred")!.frontier, true);
	assert.equal(explicit.get("residual")!.frontier, false); // Explicit doesn't override human eligibility/claims.
	assert.equal(local.get("lookalike")!.frontier, false);
	assert.equal(local.get("provisional-child")!.provisional, true);
	assert.equal(local.get("provisional-child")!.satisfied, false);
	assert.deepEqual(local.get("provisional")!.claims, []);
	assert.equal(local.get("provisional")!.frontier, false);
	assert.equal(local.get("own-done")!.satisfied, false);
	assert.equal(local.get("own-done")!.effectiveStage, "ticket");
	show("Collector root: a landed, canonical done unchanged", local,
		["root", "a", "b", "omitted", "residual", "human", "deferred", "guarded", "provisional", "provisional-child", "lookalike"]);
	show("Different collector: same ledger cannot release b", other, ["a", "b"]);
	show("Owner path: outside still blocked by a", owner, ["a", "b", "outside"]);
	show("Explicit selection: priority-4 preference lifted", explicit, ["deferred"]);

	// Ticket promotion is not acceptance. A foreign lookalike claim is never ignored.
	const promoted = new Map(global);
	const child = global.get("provisional-child")!;
	promoted.set(child.slug, { ...child, ownStage: "ticket" });
	const promotedView = schedulingView(promoted, { ...context, landed: ledger });
	assert.equal(promotedView.get(child.slug)!.satisfied, false);
	assert.equal(promotedView.get(child.slug)!.frontier, false);
	assert.equal(promotedView.get("provisional")!.frontier, false);
	const accepted = schedulingView(promoted, { ...context, landed: ledger, withheld: new Set() });
	assert.equal(accepted.get("provisional")!.frontier, true);
	show("Ticket promotion still withheld; removing withheld is acceptance", promotedView, ["provisional", child.slug]);
	show("Accepted scope (same owned attempt claim)", accepted, ["provisional", child.slug]);

	assert.deepEqual(JSON.parse(run(["snapshot", "--json"])).issues, canonical);
	console.log("Canonical CLI snapshot unchanged after all private projections.");
	assert.deepEqual([...context.attemptClaims], ["reconcile:root/refine-active"]);
	assert.deepEqual([...context.withheld], ["provisional-child"]);
	assert.deepEqual(context.landed, {});
	assert.equal(JSON.stringify([...global]), input);
	assert.equal(JSON.stringify(ledger), JSON.stringify(land("root")));
	for (const [slug, row] of global) assert.notEqual(local.get(slug), row);
	console.log("Input immutability: true (frozen DTO rows/arrays, unchanged global map and ledger, new output rows).");
	console.log("Projection probe passed; helper only, no production scheduler or code landing exercised.");
} finally {
	rmSync(vault, { recursive: true, force: true });
	console.log("Deleted owned temporary vault.");
}
