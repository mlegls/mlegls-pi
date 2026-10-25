// Tracker frontend: the project's vault tracker as a Linear-like list and tree, read-only, with agent actions. Every
// write is an agent's: supervise a ready tree (new or existing supervisor), shape a tree that isn't ready, or discuss
// selected issues in a new thread with them mentioned.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
	definePluginApp,
	experimental_NewThreadComposer as NewThreadComposer,
	experimental_usePluginId,
	Markdown,
	useBbNavigate,
	useRealtime,
	useRealtimeConnectionState,
	useRpc,
	useSdk,
} from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract, Supervisor, SuperviseTarget, TrackerProject } from "./server";
import { CHANGED, MENTION_PROVIDER, notReady, stageLabel, title, type Issue, type Snapshot } from "./model";
import { CampaignsPage } from "./campaigns-page";
import { DiscussDialog, Empty, issueTarget, useProject } from "./shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type View = "tree" | "ready" | "mine" | "done" | "archived";
const VIEWS: { id: View; label: string; hint: string }[] = [
	{ id: "tree", label: "Tree", hint: "Live issues by part-of" },
	{ id: "ready", label: "Ready", hint: "The frontier: ready subtrees a supervisor can take now" },
	{ id: "mine", label: "Mine", hint: "Assigned to a human" },
	{ id: "done", label: "Done", hint: "Live results awaiting digestion" },
	{ id: "archived", label: "Archived", hint: "docs/issues/archive" },
];

const STAGE_DOT: Record<string, string> = {
	idea: "bg-zinc-400",
	goal: "bg-violet-500",
	spec: "bg-sky-500",
	ticket: "bg-emerald-500",
	done: "bg-transparent ring-1 ring-inset ring-muted-foreground",
	container: "bg-amber-500",
	legacy: "bg-orange-400",
};
const dotOf = (i: Issue) => STAGE_DOT[i.legacy ? "legacy" : (i.effectiveStage ?? i.ownStage ?? "container")] ?? "bg-zinc-400";
const isMine = (i: Issue) => !!i.assignee && /(^|,)\s*(human|user:)/.test(i.assignee);

function useSnapshot(projectId: string | null) {
	const rpc = useRpc<typeof rpcContract>();
	const [snap, setSnap] = useState<Snapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const refetch = useCallback(() => {
		if (!projectId) return;
		rpc.call("snapshot", { projectId }).then((s) => { setSnap(s); setError(null); }, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, [rpc, projectId]);
	useEffect(() => { setSnap(null); refetch(); }, [refetch]);
	useRealtime(CHANGED, (payload) => {
		const root = (payload as { root?: string } | null)?.root;
		if (!root || !snap || root === snap.root) refetch();
	});
	// Signals aren't replayed: reconcile after a reconnect.
	const conn = useRealtimeConnectionState();
	const seen = useRef(conn);
	useEffect(() => { if (seen.current !== "connected" && conn === "connected") refetch(); seen.current = conn; }, [conn, refetch]);
	return { snap, error, refetch };
}

/** The page's route: /plugins/tracker/issues/<projectId>/<slug>. */
function parseSub(subPath: string): { projectId: string | null; slug: string | null } {
	const [projectId, slug] = subPath.split("/").filter(Boolean);
	return { projectId: projectId ?? null, slug: slug ?? null };
}

interface Row { issue: Issue; depth: number; kids: number; doneKids: number; hasKids: boolean; context: boolean }

function rowsFor(snap: Snapshot, view: View, query: string, showDone: boolean, collapsed: Set<string>): Row[] {
	const all = snap.issues;
	const kids = new Map<string, Issue[]>();
	for (const i of all) if (i.partOf) kids.set(i.partOf, [...(kids.get(i.partOf) ?? []), i]);
	const bySlug = new Map(all.map((i) => [i.slug, i]));
	const roll = (slug: string) => { const k = kids.get(slug) ?? []; return { kids: k.length, doneKids: k.filter((c) => c.done || c.archived).length }; };
	const q = query.trim().toLowerCase().replace(/\s+/g, "-");
	const hit = (i: Issue) => !q || i.slug.includes(q) || (i.assignee ?? "").toLowerCase().includes(q);
	const byPriority = (a: Issue, b: Issue) => (a.priority ?? 9) - (b.priority ?? 9) || a.slug.localeCompare(b.slug);

	if (view !== "tree") {
		const keep = all.filter((i) => hit(i) && (
			view === "ready" ? i.frontier && !i.archived
			: view === "mine" ? isMine(i) && !i.done && !i.archived
			: view === "done" ? i.done && !i.archived
			: i.archived));
		return keep.sort(byPriority).map((issue) => ({ issue, depth: 0, ...roll(issue.slug), hasKids: false, context: false }));
	}
	// Tree: live issues; matches keep their ancestors as context.
	const live = (i: Issue) => !i.archived && (showDone || !i.done);
	const visible = new Set<string>();
	for (const i of all) {
		if (!live(i) || !hit(i)) continue;
		for (let at: Issue | undefined = i; at && !visible.has(at.slug); at = at.partOf ? bySlug.get(at.partOf) : undefined) visible.add(at.slug);
	}
	const out: Row[] = [];
	const walk = (i: Issue, depth: number) => {
		const children = (kids.get(i.slug) ?? []).filter((c) => visible.has(c.slug)).sort(byPriority);
		out.push({ issue: i, depth, ...roll(i.slug), hasKids: children.length > 0, context: !!q && !hit(i) });
		if (!collapsed.has(i.slug)) for (const c of children) walk(c, depth + 1);
	};
	for (const i of all.filter((i) => visible.has(i.slug) && !(i.partOf && visible.has(i.partOf))).sort(byPriority)) walk(i, 0);
	return out;
}

function StageBadge({ issue }: { issue: Issue }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title={"stage: " + stageLabel(issue)}>
			<span className={cn("size-2 rounded-full", dotOf(issue))} />
			<span className="w-[4.5rem] truncate">{stageLabel(issue)}</span>
		</span>
	);
}

function Pill({ children, tone = "muted", title: hint }: { children: ReactNode; tone?: "muted" | "ready" | "warn"; title?: string }) {
	return (
		<span title={hint} className={cn("inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] leading-none",
			tone === "ready" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
			: tone === "warn" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
			: "bg-muted text-muted-foreground")}>{children}</span>
	);
}

function Progress({ done, total }: { done: number; total: number }) {
	if (!total) return <span className="w-14 shrink-0" />;
	return (
		<span className="flex w-14 shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground" title={done + " of " + total + " sub-issues done"}>
			<span className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-emerald-500" style={{ width: (100 * done) / total + "%" }} /></span>
			{done}/{total}
		</span>
	);
}

function IconAction({ icon, label, onClick }: { icon: string; label: string; onClick: (e: ReactMouseEvent) => void }) {
	return <button type="button" title={label} aria-label={label} onClick={onClick} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7")}><Icon name={icon} className="size-4" /></button>;
}

interface Actions {
	discuss: (slugs: string[]) => void;
	supervise: (slugs: string[]) => void;
	refine: (slugs: string[]) => void;
}

function IssueRow({ row, selected, checked, anyChecked, onOpen, onCheck, onToggle, collapsed, actions, compact }: {
	row: Row; selected: boolean; checked: boolean; anyChecked: boolean; collapsed: boolean; compact: boolean;
	onOpen: () => void; onCheck: (v: boolean) => void; onToggle: () => void; actions: Actions;
}) {
	const i = row.issue;
	const stop = (f: () => void) => (e: ReactMouseEvent) => { e.stopPropagation(); f(); };
	return (
		<div
			role="row"
			aria-selected={selected}
			data-slug={i.slug}
			onClick={onOpen}
			className={cn("group flex h-9 cursor-pointer items-center gap-2 border-b border-border/60 pr-2 text-sm",
				selected ? "bg-state-active" : "hover:bg-state-hover", row.context && "opacity-50")}
		>
			<span className={cn("flex w-7 shrink-0 justify-center", !anyChecked && !checked && "opacity-0 group-hover:opacity-100")} onClick={(e) => e.stopPropagation()}>
				<Checkbox checked={checked} onCheckedChange={(v) => onCheck(v === true)} aria-label={"Select " + i.slug} />
			</span>
			<span style={{ width: row.depth * 16 }} className="shrink-0" />
			<button type="button" onClick={stop(onToggle)} className={cn("flex size-4 shrink-0 items-center justify-center text-muted-foreground", !row.hasKids && "invisible")} aria-label={collapsed ? "Expand" : "Collapse"}>
				<Icon name={collapsed ? "ChevronRight" : "ChevronDown"} className="size-3.5" />
			</button>
			<StageBadge issue={i} />
			<span className="min-w-0 flex-1 truncate" title={i.slug}>{title(i.slug)}</span>
			<span className={cn("hidden shrink-0 items-center gap-1", !compact && "md:flex")}>
				{i.frontier ? <Pill tone="ready" title="On the frontier: a supervisor can take this tree now">ready</Pill> : null}
				{i.blockers.length ? <Pill tone="warn" title={"blocked by " + i.blockers.join(", ")}>blocked {i.blockers.length}</Pill> : null}
				{i.claims.length ? <Pill title={"claimed by " + i.claims.join(", ")}>claimed</Pill> : null}
			</span>
			{compact
				? <>{i.frontier ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" title="ready" /> : i.blockers.length ? <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title={"blocked by " + i.blockers.join(", ")} /> : null}</>
				: <>
					<Progress done={row.doneKids} total={row.kids} />
					<span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground lg:block" title={i.assignee ?? ""}>{i.assignee ?? ""}</span>
					<span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i.priority ? "P" + i.priority : ""}</span>
				</>}
			<span className={cn("shrink-0 items-center gap-0.5", compact ? "hidden group-hover:flex" : "flex opacity-0 group-hover:opacity-100")}>
				<IconAction icon="MessageSquarePlus" label="Discuss in a new thread" onClick={stop(() => actions.discuss([i.slug]))} />
				{i.frontier
					? <IconAction icon="Play" label="Send to a supervisor" onClick={stop(() => actions.supervise([i.slug]))} />
					: !i.done && !i.archived
						? <IconAction icon="Brain" label={"Refine with shape: " + notReady(i)} onClick={stop(() => actions.refine([i.slug]))} />
						: <span className="size-7" />}
			</span>
		</div>
	);
}

/** Keep issue navigation in-page; file wikilinks are resolved by the server after Markdown renders. */
function linkify(body: string, repo: string): string {
	return body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => {
		const issue = new RegExp("^projects/" + repo.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "/issues/(?:archive/)?([^/#]+)$").exec(target);
		if (issue) return "[" + (alias ?? issue[1]) + "](#tracker-issue=" + issue[1] + ")";
		return "[" + (alias ?? target.split("/").pop()!) + "](#tracker-file=" + encodeURIComponent(target) + ")";
	});
}

function Detail({ projectId, snap, slug, open, actions, onClose }: { projectId: string; snap: Snapshot; slug: string; open: (slug: string) => void; actions: Actions; onClose: () => void }) {
	const rpc = useRpc<typeof rpcContract>();
	const navigate = useBbNavigate();
	const bodyRef = useRef<HTMLDivElement>(null);
	const files = useRef(new Map<string, { kind: "host"; hostId: string; path: string }>());
	const [doc, setDoc] = useState<{ body: string; path: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const issue = snap.issues.find((i) => i.slug === slug);
	useEffect(() => {
		let active = true;
		setDoc(null); setError(null); files.current.clear();
		rpc.call("issue", { projectId, slug }).then(d => { if (active) setDoc(d); }, (e: unknown) => { if (active) setError(e instanceof Error ? e.message : String(e)); });
		return () => { active = false; };
	}, [rpc, projectId, slug, snap.at]);
	useEffect(() => {
		const root = bodyRef.current;
		if (!doc || !root) return;
		let active = true;
		const seen = new WeakSet<HTMLAnchorElement>();
		const resolve = () => {
			const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]")).filter(a => {
				const href = a.getAttribute("href")!;
				return !seen.has(a) && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) && (!href.startsWith("#") || href.startsWith("#tracker-file=") || href.startsWith("#tracker-issue="));
			});
			const missing = (a: HTMLAnchorElement, reason: string) => {
				a.removeAttribute("href");
				a.title = reason;
				a.className = "text-inherit no-underline";
				a.removeAttribute("target");
			};
			const local = links.filter(a => {
				seen.add(a);
				const href = a.getAttribute("href")!;
				if (!href.startsWith("#tracker-issue=")) return true;
				const slug = decodeURIComponent(href.slice("#tracker-issue=".length));
				if (!snap.issues.some(i => i.slug === slug)) missing(a, "Issue does not exist: " + slug);
				return false;
			});
			for (let at = 0; at < local.length; at += 200) {
				const batch = local.slice(at, at + 200);
				rpc.call("resolveLinks", { projectId, slug, hrefs: batch.map(a => a.getAttribute("href")!) }).then(results => {
					if (!active) return;
					for (const [i, result] of results.entries()) {
						if (result.target) files.current.set(result.href, result.target);
						else missing(batch[i], result.reason ?? "File does not exist");
					}
				}, e => { if (active) toast.error("Could not resolve issue links: " + String(e)); });
			}
		};
		resolve();
		// Markdown may finish rendering after its host commits.
		const observer = new MutationObserver(resolve);
		observer.observe(root, { childList: true, subtree: true });
		return () => { active = false; observer.disconnect(); };
	}, [rpc, projectId, slug, doc, snap.issues]);
	const children = snap.issues.filter((i) => i.partOf === slug);
	if (!issue) return <div className="p-4 text-sm text-muted-foreground">No issue {slug}.</div>;
	const onClick = (e: ReactMouseEvent) => {
		const a = (e.target as HTMLElement).closest("a");
		const m = a && /#tracker-issue=([^&]+)$/.exec(a.getAttribute("href") ?? "");
		if (m) { e.preventDefault(); e.stopPropagation(); open(decodeURIComponent(m[1])); return; }
		const href = a?.getAttribute("href");
		if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || (href.startsWith("#") && !href.startsWith("#tracker-file="))) return;
		e.preventDefault(); e.stopPropagation();
		const target = files.current.get(href);
		if (target && !navigate.experimental_openFilePreview({ target, location: null })) toast.error("No file preview is available for " + target.path);
	};
	const Link = ({ to }: { to: string }) => {
		const t = snap.issues.find((i) => i.slug === to);
		return (
			<button type="button" onClick={() => open(to)} className="inline-flex max-w-full items-center gap-1.5 truncate rounded px-1 text-left hover:bg-state-hover">
				{t ? <span className={cn("size-2 shrink-0 rounded-full", dotOf(t))} /> : null}
				<span className="truncate">{to}</span>
			</button>
		);
	};
	const field = (label: string, value: ReactNode) => (
		<><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0">{value}</dd></>
	);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-start gap-2 border-b border-border px-4 py-3">
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-semibold leading-snug">{title(slug)}</h2>
					<p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={doc?.path}>{issue.path}</p>
				</div>
				<Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose} aria-label="Close"><Icon name="X" className="size-4" /></Button>
			</div>
			<div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
				<Button size="sm" variant="outline" onClick={() => actions.discuss([slug])}><Icon name="MessageSquarePlus" />Discuss</Button>
				{issue.frontier
					? <Button size="sm" onClick={() => actions.supervise([slug])}><Icon name="Play" />Supervise</Button>
					: !issue.done && !issue.archived ? <Button size="sm" variant="outline" onClick={() => actions.refine([slug])}><Icon name="Brain" />Refine</Button> : null}
				{!issue.frontier && !issue.done ? <span className="text-xs text-muted-foreground">{notReady(issue)}</span> : null}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				<dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
					{field("Stage", <StageBadge issue={issue} />)}
					{field("Assignee", issue.assignee ?? "—")}
					{issue.priority ? field("Priority", "P" + issue.priority) : null}
					{issue.partOf ? field("Part of", <Link to={issue.partOf} />) : null}
					{children.length ? field("Sub-issues", <div className="flex flex-col">{children.map((c) => <Link key={c.slug} to={c.slug} />)}</div>) : null}
					{issue.blockedBy.length || issue.guards.length ? field("Blocked by", <div className="flex flex-col">{issue.blockedBy.map((b) => <Link key={b} to={b} />)}{issue.guards.map((g) => <span key={g} className="px-1">{g}</span>)}</div>) : null}
					{issue.claims.length ? field("Claimed by", issue.claims.join(", ")) : null}
				</dl>
				<div ref={bodyRef} className="mt-4 border-t border-border pt-3 text-sm" onClickCapture={onClick}>
					{error ? <p className="text-destructive">{error}</p> : doc ? <Markdown content={linkify(doc.body, snap.repo)} /> : <p className="text-muted-foreground">Loading…</p>}
				</div>
			</div>
		</div>
	);
}

function SuperviseDialog({ projectId, slugs, onOpenChange }: { projectId: string; slugs: string[]; onOpenChange: (open: boolean) => void }) {
	const rpc = useRpc<typeof rpcContract>();
	const navigate = useBbNavigate();
	const [list, setList] = useState<Supervisor[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	useEffect(() => { rpc.call("supervisors", { projectId }).then((r) => setList(r.supervisors), (e: unknown) => setError(String(e instanceof Error ? e.message : e))); }, [rpc, projectId]);
	const send = async (target: SuperviseTarget) => {
		setBusy(true);
		try {
			const r = await rpc.call("supervise", { projectId, slugs, target });
			toast.success(r.note);
			onOpenChange(false);
			if (r.threadId) navigate.toThread(r.threadId);
		} catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
	};
	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Supervise {slugs.length === 1 ? title(slugs[0]) : slugs.length + " trees"}</DialogTitle>
					<DialogDescription>{slugs.length === 1 ? "Its subtree is" : "Their subtrees are"} on the tracker's frontier. Start a supervisor or hand {slugs.length === 1 ? "it" : "them"} to one already running.</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-1">
					<button type="button" disabled={busy} onClick={() => send({ kind: "new" })} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-state-hover disabled:opacity-50">
						<Icon name="Plus" className="size-4" />
						<span className="flex-1"><span className="font-medium">New supervisor</span><span className="block text-xs text-muted-foreground">pi thread running /skill:supervise in the project checkout</span></span>
					</button>
					{list === null && !error ? <p className="px-1 py-2 text-xs text-muted-foreground">Finding supervisors…</p> : null}
					{list?.map((s) => (
						<button key={s.threadId ?? s.title} type="button" disabled={busy} onClick={() => send(s.threadId ? { kind: "thread", threadId: s.threadId } : { kind: "role" })} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-state-hover disabled:opacity-50">
							<Icon name={s.role ? "Star" : "Eye"} className="size-4" />
							<span className="min-w-0 flex-1">
								<span className="block truncate font-medium">{s.title}</span>
								<span className="block truncate text-xs text-muted-foreground">{[s.role ? "project supervisor (role)" : "", s.status, s.issues.length ? "supervising " + s.issues.join(", ") : ""].filter(Boolean).join(" · ")}</span>
							</span>
						</button>
					))}
				</div>
				{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
			</DialogContent>
		</Dialog>
	);
}

function TrackerPage({ subPath }: { subPath: string }) {
	const rpc = useRpc<typeof rpcContract>();
	const navigate = useBbNavigate();
	const route = parseSub(subPath);
	const { projects, projectId } = useProject(route.projectId);
	const go = useCallback((pid: string, slug: string | null, replace = false) => navigate.toPluginPanel("issues", { subPath: pid + (slug ? "/" + slug : ""), replace }), [navigate]);

	const { snap, error } = useSnapshot(projectId);
	const [view, setView] = useState<View>("tree");
	const [query, setQuery] = useState("");
	const [showDone, setShowDone] = useState(false);
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [checked, setChecked] = useState<Set<string>>(new Set());
	const [discuss, setDiscuss] = useState<string[] | null>(null);
	const [supervise, setSupervise] = useState<string[] | null>(null);
	useEffect(() => { setChecked(new Set()); }, [projectId]);

	const rows = useMemo(() => (snap ? rowsFor(snap, view, query, showDone, collapsed) : []), [snap, view, query, showDone, collapsed]);
	const bySlug = useMemo(() => new Map(snap?.issues.map((i) => [i.slug, i]) ?? []), [snap]);
	const counts = useMemo(() => {
		const is = snap?.issues ?? [];
		return { tree: is.filter((i) => !i.archived && !i.done).length, ready: is.filter((i) => i.frontier && !i.archived).length, mine: is.filter((i) => isMine(i) && !i.done && !i.archived).length, done: is.filter((i) => i.done && !i.archived).length, archived: is.filter((i) => i.archived).length } as Record<View, number>;
	}, [snap]);

	const rpcRefine = useCallback(async (slugs: string[]) => {
		if (!projectId) return;
		try { const r = await rpc.call("refine", { projectId, slugs }); toast.success("Started a shaping session"); navigate.toThread(r.threadId); }
		catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
	}, [rpc, projectId, navigate]);
	const actions: Actions = useMemo(() => ({ discuss: setDiscuss, supervise: setSupervise, refine: rpcRefine }), [rpcRefine]);

	const selected = [...checked].filter((s) => bySlug.has(s));
	const allReady = selected.length > 0 && selected.every((s) => bySlug.get(s)!.frontier);
	const open = useCallback((slug: string) => { if (projectId) go(projectId, slug); }, [projectId, go]);

	// j/k move, x selects, Enter or o opens, d discusses, s supervises (or refines), Escape clears.
	const listRef = useRef<HTMLDivElement>(null);
	const [cursor, setCursor] = useState<string | null>(null);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			if (discuss || supervise || e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
			const at = Math.max(0, rows.findIndex((r) => r.issue.slug === (cursor ?? route.slug)));
			const move = (n: number) => { const r = rows[Math.min(rows.length - 1, Math.max(0, at + n))]; if (r) { setCursor(r.issue.slug); listRef.current?.querySelector('[data-slug="' + r.issue.slug + '"]')?.scrollIntoView({ block: "nearest" }); } };
			const current = cursor ?? route.slug;
			const target = checked.size ? [...checked] : current ? [current] : [];
			if (e.key === "j" || e.key === "ArrowDown") move(1);
			else if (e.key === "k" || e.key === "ArrowUp") move(-1);
			else if (e.key === "x" && current) setChecked((s) => { const n = new Set(s); n.has(current) ? n.delete(current) : n.add(current); return n; });
			else if ((e.key === "Enter" || e.key === "o") && current) open(current);
			else if (e.key === "d" && target.length) setDiscuss(target);
			else if (e.key === "s" && target.length) (target.every((s) => bySlug.get(s)?.frontier) ? setSupervise : rpcRefine)(target);
			else if (e.key === "Escape") { if (checked.size) setChecked(new Set()); else if (route.slug && projectId) go(projectId, null); }
			else return;
			e.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [rows, cursor, route.slug, checked, discuss, supervise, open, bySlug, rpcRefine, projectId, go]);

	if (projects && projects.length === 0) return <Empty>No bb project has a <code>docs/issues</code> tracker.</Empty>;
	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
				<select className="h-8 rounded-md border border-input bg-transparent px-2 text-sm" value={projectId ?? ""} onChange={(e) => go(e.target.value, null)} aria-label="Project">
					{projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
				</select>
				<div className="flex items-center rounded-md border border-border p-0.5">
					{VIEWS.map((v) => (
						<button key={v.id} type="button" title={v.hint} onClick={() => setView(v.id)} className={cn("h-7 rounded px-2.5 text-xs", view === v.id ? "bg-state-active text-foreground" : "text-muted-foreground hover:text-foreground")}>
							{v.label} <span className="tabular-nums opacity-60">{snap ? counts[v.id] : ""}</span>
						</button>
					))}
				</div>
				{view === "tree" ? (
					<label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} />Show done</label>
				) : null}
				<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter" className="ml-auto h-8 w-48" aria-label="Filter issues" />
			</div>
			<div className="flex min-h-0 flex-1">
				<div ref={listRef} role="grid" className={cn("min-h-0 overflow-y-auto", route.slug ? "w-[42%] min-w-[20rem] border-r border-border" : "flex-1")}>
					{error ? <Empty>{error}</Empty> : !snap ? <Empty>Loading issues…</Empty> : rows.length === 0 ? <Empty>Nothing here.</Empty> : rows.map((row) => (
						<IssueRow
							key={row.issue.slug}
							row={row}
							selected={row.issue.slug === route.slug || row.issue.slug === cursor}
							checked={checked.has(row.issue.slug)}
							anyChecked={checked.size > 0}
							collapsed={collapsed.has(row.issue.slug)}
							onOpen={() => { setCursor(row.issue.slug); open(row.issue.slug); }}
							onCheck={(v) => setChecked((s) => { const n = new Set(s); v ? n.add(row.issue.slug) : n.delete(row.issue.slug); return n; })}
							onToggle={() => setCollapsed((s) => { const n = new Set(s); n.has(row.issue.slug) ? n.delete(row.issue.slug) : n.add(row.issue.slug); return n; })}
							actions={actions}
							compact={!!route.slug}
						/>
					))}
				</div>
				{route.slug && snap && projectId ? (
					<div className="min-h-0 min-w-0 flex-1">
						<Detail projectId={projectId} snap={snap} slug={route.slug} open={open} actions={actions} onClose={() => go(projectId, null)} />
					</div>
				) : null}
			</div>
			{selected.length ? (
				<div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2 text-sm">
					<span className="tabular-nums">{selected.length} selected</span>
					<Button size="sm" variant="outline" onClick={() => setDiscuss(selected)}><Icon name="MessageSquarePlus" />Discuss</Button>
					{allReady
						? <Button size="sm" onClick={() => setSupervise(selected)}><Icon name="Play" />Supervise</Button>
						: <span title={selected.filter((s) => !bySlug.get(s)!.frontier).map((s) => s + ": " + notReady(bySlug.get(s)!)).join("\n")}><Button size="sm" variant="outline" onClick={() => rpcRefine(selected)}><Icon name="Brain" />Refine</Button></span>}
					{!allReady ? <span className="truncate text-xs text-muted-foreground">{selected.filter((s) => !bySlug.get(s)!.frontier).length} not ready for supervision</span> : null}
					<Button size="sm" variant="ghost" className="ml-auto" onClick={() => setChecked(new Set())}>Clear</Button>
				</div>
			) : null}
			{discuss && projectId ? <DiscussDialog projectId={projectId} targets={discuss.map(issueTarget)} onOpenChange={(o) => { if (!o) setDiscuss(null); }} onRemove={(s) => setDiscuss((d) => d && d.filter((x) => x !== s))} /> : null}
			{supervise && projectId ? <SuperviseDialog projectId={projectId} slugs={supervise} onOpenChange={(o) => { if (!o) setSupervise(null); }} /> : null}
		</div>
	);
}

export default definePluginApp((app) => {
	app.slots.navPanel({ id: "issues", title: "Issues", icon: "ListView", path: "issues", component: TrackerPage });
	app.slots.navPanel({ id: "campaigns", title: "Campaigns", icon: "Target", path: "campaigns", component: CampaignsPage });
});
