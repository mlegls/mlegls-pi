// The Campaigns page: docs/departments.md as the project's progress and planning view. Departments are the
// maintainer's perspectives; each ranks its campaigns, top-down views over the tracker with good-enough bars. The page
// only reads; its actions start threads (discuss a department, campaign or promise; triage what no campaign tracks)
// and jump to the issues and threads it shows.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBbNavigate, useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { toast } from "sonner";
import { CAMPAIGN_MENTION, CHANGED, chartStart, weekIndex, WEEKS, title, type Activity, type ActivityKind, type CampaignView, type Campaigns, type CommitInfo, type DepartmentView, type Level } from "./model";
import { DiscussDialog, Empty, useProject, type Target } from "./shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function useCampaigns(projectId: string | null) {
	const rpc = useRpc<typeof rpcContract>();
	const [view, setView] = useState<Campaigns | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const load = useCallback((refresh = false) => {
		if (!projectId) return;
		if (refresh) setBusy(true);
		rpc.call("campaigns", { projectId, refresh }).then((v) => { setView(v); setError(null); }, (e: unknown) => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusy(false));
	}, [rpc, projectId]);
	useEffect(() => { setView(null); load(); }, [load]);
	useRealtime(CHANGED, (payload) => {
		const root = (payload as { root?: string } | null)?.root;
		if (!root || !view || root === view.root) load();
	});
	// Reconcilers move without touching files the server watches.
	useEffect(() => { const t = setInterval(() => load(), 60_000); return () => clearInterval(t); }, [load]);
	const conn = useRealtimeConnectionState();
	const seen = useRef(conn);
	useEffect(() => { if (seen.current !== "connected" && conn === "connected") load(); seen.current = conn; }, [conn, load]);
	return { view, error, busy, refresh: () => load(true) };
}

const LEVEL: Record<Level, { icon: string; className: string; label: string }> = {
	ok: { icon: "CircleCheck", className: "text-emerald-600", label: "kept" },
	risk: { icon: "TriangleAlert", className: "text-amber-500", label: "at risk" },
	broken: { icon: "CircleX", className: "text-red-600", label: "broken" },
	unknown: { icon: "CircleHelp", className: "text-muted-foreground", label: "unknown" },
};

function ago(date: string | null): string {
	if (!date) return "not in " + WEEKS + " weeks";
	const days = Math.round((Date.now() - Date.parse(date)) / 86_400_000);
	return days <= 0 ? "today" : days === 1 ? "yesterday" : days + " days ago";
}

function IconAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
	return <button type="button" title={label} aria-label={label} onClick={onClick} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7 shrink-0")}><Icon name={icon} className="size-4" /></button>;
}

/** Done, settled (goal, spec, ticket) and ideas as one bar. */
function Split({ counts }: { counts: CampaignView["counts"] }) {
	const total = counts.done + counts.settled + counts.idea;
	const pct = (n: number) => (total ? (n / total) * 100 : 0) + "%";
	return (
		<div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" title={counts.done + " done · " + counts.settled + " settled · " + counts.idea + " ideas"}>
			<div className="bg-emerald-500" style={{ width: pct(counts.done) }} />
			<div className="bg-sky-500" style={{ width: pct(counts.settled) }} />
			<div className="bg-zinc-400/60" style={{ width: pct(counts.idea) }} />
		</div>
	);
}

const KIND: Record<ActivityKind, { bar: string; dot: string; label: string }> = {
	done: { bar: "bg-emerald-500", dot: "bg-emerald-500", label: "done" },
	settled: { bar: "bg-sky-500", dot: "bg-sky-500", label: "goal, spec or ticket" },
	idea: { bar: "bg-zinc-400", dot: "bg-zinc-400", label: "new idea" },
};
const KINDS: ActivityKind[] = ["done", "settled", "idea"];
const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Stage changes per week as stacked bars on the page's shared scale; hovering opens the day grid. */
function ActivityChart({ c, view, openIssue }: { c: CampaignView; view: Campaigns; openIssue: (slug: string) => void }) {
	const [open, setOpen] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const weeks = Array.from({ length: WEEKS }, () => ({ done: 0, settled: 0, idea: 0 }));
	for (const a of c.activity) { const w = weekIndex(a.date); if (w >= 0 && w < WEEKS) weeks[w][a.kind]++; }
	const enter = () => { clearTimeout(timer.current); setOpen(true); };
	const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 200); };
	useEffect(() => () => clearTimeout(timer.current), []);
	return (
		<div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
			<div className="flex h-7 cursor-default items-end gap-px" aria-label="Stage changes per week">
				{weeks.map((w, i) => (
					<div key={i} className="flex w-1.5 flex-col-reverse overflow-hidden rounded-sm bg-muted" style={{ height: "28px" }}>
						{KINDS.map((k) => w[k] ? <div key={k} className={KIND[k].bar} style={{ height: (w[k] / view.scale.week) * 28 + "px" }} /> : null)}
					</div>
				))}
			</div>
			{open ? <DayGrid c={c} view={view} openIssue={openIssue} /> : null}
		</div>
	);
}

/** GitHub-style grid of the last WEEKS weeks by day; a day lists its stage changes by commit. */
function DayGrid({ c, view, openIssue }: { c: CampaignView; view: Campaigns; openIssue: (slug: string) => void }) {
	const start = chartStart();
	const today = isoDay(Date.now());
	const byDay = new Map<string, Activity[]>();
	for (const a of c.activity) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);
	const latest = [...byDay.keys()].sort().at(-1) ?? null;
	const [pinned, setPinned] = useState<string | null>(null);
	const [hover, setHover] = useState<string | null>(null);
	const day = hover ?? pinned ?? latest;
	const cell = (date: string) => {
		const list = byDay.get(date) ?? [];
		if (date > today) return "bg-transparent";
		if (!list.length) return "bg-muted";
		const kind = KINDS.find((k) => list.some((a) => a.kind === k)) ?? "idea";
		const level = Math.min(4, Math.ceil((list.length / view.scale.day) * 4));
		return cn(KIND[kind].bar, ["", "opacity-40", "opacity-60", "opacity-80", "opacity-100"][level]);
	};
	const items = day ? byDay.get(day) ?? [] : [];
	const commits = [...new Set(items.map((a) => a.commit))];
	const months = Array.from({ length: WEEKS }, (_, w) => {
		const d = new Date(start + w * 7 * DAY_MS);
		return d.getUTCDate() <= 7 ? d.toLocaleString(undefined, { month: "short", timeZone: "UTC" }) : "";
	});
	return (
		<div className="absolute right-0 top-full z-30 mt-1 flex w-[26rem] flex-col gap-2 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
			<div className="flex items-center gap-3 text-xs text-muted-foreground">
				<span className="flex-1">Stage changes on main, last {WEEKS} weeks</span>
				{KINDS.map((k) => <span key={k} className="flex items-center gap-1"><span className={cn("size-2 rounded-sm", KIND[k].dot)} />{KIND[k].label}</span>)}
			</div>
			<div className="flex gap-1">
				<div className="mt-4 grid grid-rows-7 gap-[3px] pr-1 text-[9px] leading-[13px] text-muted-foreground">
					{["Mon", "", "Wed", "", "Fri", "", ""].map((d, i) => <span key={i}>{d}</span>)}
				</div>
				<div className="flex flex-col gap-1">
					<div className="flex gap-[3px] text-[9px] leading-3 text-muted-foreground">{months.map((m, i) => <span key={i} className="w-[13px] overflow-visible whitespace-nowrap">{m}</span>)}</div>
					<div className="grid grid-flow-col grid-rows-7 gap-[3px]" onMouseLeave={() => setHover(null)}>
						{Array.from({ length: WEEKS * 7 }, (_, i) => {
							const date = isoDay(start + i * DAY_MS);
							const n = byDay.get(date)?.length ?? 0;
							return (
								<button key={date} type="button" disabled={date > today} title={date + ": " + n + " stage change" + (n === 1 ? "" : "s")}
									onMouseEnter={() => setHover(date)} onClick={() => setPinned((p) => (p === date ? null : date))}
									className={cn("size-[13px] rounded-[3px]", cell(date), date === day && "ring-2 ring-foreground/60")} />
							);
						})}
					</div>
				</div>
			</div>
			<div className="border-t border-border pt-2 text-sm">
				{!day ? <div className="text-xs text-muted-foreground">No stage changes in {WEEKS} weeks.</div> : (
					<>
						<div className="mb-1 text-xs text-muted-foreground">{new Date(day + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })} · {items.length} change{items.length === 1 ? "" : "s"}{pinned === day ? " · pinned" : ""}</div>
						<div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
							{commits.map((h) => <CommitGroup key={h} hash={h} info={view.commits[h]} url={view.commitUrl} items={items.filter((a) => a.commit === h)} openIssue={openIssue} />)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function CommitGroup({ hash, info, url, items, openIssue }: { hash: string; info?: CommitInfo; url: string | null; items: Activity[]; openIssue: (slug: string) => void }) {
	const short = hash.slice(0, 8);
	const label = <><code className="text-[11px]">{short}</code> <span className="truncate">{info?.subject || "commit"}</span></>;
	return (
		<div className="flex flex-col">
			{url && info?.pushed
				? <a href={url + hash} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 rounded px-1 text-xs text-muted-foreground hover:bg-state-hover hover:text-foreground" title="Open on GitHub">{label}<Icon name="ExternalLink" className="size-3 shrink-0" /></a>
				: <button type="button" className="flex min-w-0 items-center gap-1 rounded px-1 text-left text-xs text-muted-foreground hover:bg-state-hover hover:text-foreground" title={url ? "Not on GitHub yet; copy the hash" : "Copy the hash"} onClick={() => { void navigator.clipboard.writeText(hash); toast.success("Copied " + short); }}>{label}<Icon name="Copy" className="size-3 shrink-0" /></button>}
			{items.map((a) => (
				<button key={a.slug + a.kind} type="button" onClick={() => openIssue(a.slug)} className="flex min-w-0 items-center gap-1.5 rounded py-0.5 pl-4 pr-1 text-left hover:bg-state-hover">
					<span className={cn("size-2 shrink-0 rounded-full", KIND[a.kind].dot)} /><span className="truncate">{title(a.slug)}</span>
				</button>
			))}
		</div>
	);
}

function CampaignCard({ c, view, history, onDiscuss, openIssue, openThread }: { c: CampaignView; view: Campaigns; history: boolean; onDiscuss: () => void; openIssue: (slug: string) => void; openThread: (id: string) => void }) {
	const [open, setOpen] = useState(false);
	const met = c.bars.filter((b) => b.met).length;
	const done = c.state === "done";
	return (
		<div className={cn("flex flex-col gap-2 rounded-lg border border-border bg-card p-3", done && "opacity-70")}>
			<div className="flex items-start gap-2">
				<span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{c.rank}</span>
				<div className="min-w-0 flex-1">
					<div className="font-medium leading-snug">{c.title}</div>
					{c.outcome ? <div className="text-xs text-muted-foreground">{c.outcome}</div> : null}
				</div>
				<span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px]", done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : c.bars.length ? "bg-muted text-muted-foreground" : "bg-transparent text-muted-foreground")}>{c.bars.length ? met + "/" + c.bars.length + " bars" : "ongoing"}</span>
				<IconAction icon="MessageSquarePlus" label="Discuss this campaign" onClick={onDiscuss} />
			</div>
			{c.bars.length ? (
				<ul className="ml-7 flex flex-col gap-1 text-sm">
					{c.bars.map((b, i) => (
						<li key={i} className="flex gap-1.5"><Icon name={b.met ? "SquareCheck" : "Square"} className={cn("mt-0.5 size-3.5 shrink-0", b.met ? "text-emerald-600" : "text-muted-foreground")} /><span className={cn(b.met && "text-muted-foreground line-through")}>{b.text}</span></li>
					))}
				</ul>
			) : null}
			<div className="ml-7 flex items-end gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<Split counts={c.counts} />
					<div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums">
						<span>{c.counts.done} done</span><span>{c.counts.settled} settled</span><span>{c.counts.idea} ideas</span>
						{history ? <span>· moved {ago(c.moved)}</span> : null}
						{c.landedThisWeek ? <span className="font-medium text-foreground">· {c.landedThisWeek} landed this week</span> : null}
					</div>
				</div>
				{history ? <ActivityChart c={c} view={view} openIssue={openIssue} /> : null}
			</div>
			{c.inFlight.length ? (
				<div className="ml-7 flex flex-wrap gap-1.5">
					{c.inFlight.map((f) => (
						<button key={f.slug} type="button" disabled={!f.threadId} onClick={() => f.threadId && openThread(f.threadId)} className="inline-flex h-6 max-w-full items-center gap-1 truncate rounded-md bg-sky-500/10 px-2 text-xs text-sky-700 hover:bg-sky-500/20 dark:text-sky-300" title={f.threadId ? "Open the worker's thread" : "No worker thread yet"}>
							<Icon name="Loader" className="size-3 animate-spin [animation-duration:3s]" />{title(f.slug)} · {f.phase}
						</button>
					))}
				</div>
			) : null}
			<div className="ml-7">
				<button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpen((o) => !o)}>
					{open ? "Hide" : "Show"} {c.members.length} tracked issues{c.missing.length ? " · " + c.missing.length + " unknown" : ""}
				</button>
				{open ? <Members c={c} openIssue={openIssue} /> : null}
			</div>
		</div>
	);
}

function Members({ c, openIssue }: { c: CampaignView; openIssue: (slug: string) => void }) {
	return (
		<ul className="mt-1 flex flex-col text-sm">
			{c.roots.map((slug) => (
				<li key={slug}><button type="button" onClick={() => openIssue(slug)} className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-state-hover">{title(slug)}</button></li>
			))}
			{c.missing.map((slug) => <li key={slug} className="px-1 py-0.5 text-xs text-red-600">unknown: {slug}</li>)}
		</ul>
	);
}

function Department({ d, view, history, discuss, openIssue, openThread }: { d: DepartmentView; view: Campaigns; history: boolean; discuss: (t: Target, heading: string) => void; openIssue: (slug: string) => void; openThread: (id: string) => void }) {
	const target = (kind: string, key: string, label: string): Target => ({ provider: CAMPAIGN_MENTION, id: kind + ":" + key, label });
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-start gap-2 border-b border-border pb-1.5">
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-semibold">{d.name}</h2>
					<p className="text-xs text-muted-foreground">{d.attention}</p>
				</div>
				<IconAction icon="MessageSquarePlus" label={"Discuss " + d.name} onClick={() => discuss(target("department", d.key, d.name), "Discuss " + d.name)} />
			</div>
			{d.promises.length ? (
				<ul className="flex flex-col gap-1">
					{d.promises.map((p) => {
						const l = LEVEL[p.level];
						return (
							<li key={p.key} className="group flex items-center gap-2 text-sm">
								<Icon name={l.icon} className={cn("size-4 shrink-0", l.className)} />
								<span>{p.text}</span>
								<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={p.note}>{p.note}</span>
								<span className="opacity-0 group-hover:opacity-100"><IconAction icon="MessageSquarePlus" label="Discuss this promise" onClick={() => discuss(target("promise", p.key, p.text), "Discuss a promise")} /></span>
							</li>
						);
					})}
				</ul>
			) : null}
			{d.notes.length ? <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">{d.notes.map((n, i) => <div key={i}>{n}</div>)}</div> : null}
			<div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(22rem,1fr))]">
				{d.campaigns.map((c) => (
					<CampaignCard key={c.key} c={c} view={view} history={history} openIssue={openIssue} openThread={openThread} onDiscuss={() => discuss(target("campaign", c.key, c.title), "Discuss " + c.title)} />
				))}
			</div>
		</section>
	);
}

export function CampaignsPage({ subPath }: { subPath: string }) {
	const navigate = useBbNavigate();
	const { projects, projectId } = useProject(subPath.split("/").filter(Boolean)[0] ?? null);
	const { view, error, busy, refresh } = useCampaigns(projectId);
	const [discuss, setDiscuss] = useState<{ targets: Target[]; heading: string; description: string } | null>(null);
	const [showLoose, setShowLoose] = useState(false);
	const openIssue = (slug: string) => projectId && navigate.toPluginPanel("issues", { subPath: projectId + "/" + slug });
	const openThread = (id: string) => navigate.toThread(id);
	const about = (t: Target, heading: string) => setDiscuss({ targets: [t], heading, description: "A new thread with this mentioned; the agent receives what the page shows and where it comes from, and records decisions in docs/departments.md." });

	if (projects && projects.length === 0) return <Empty>No bb project has a <code>docs/issues</code> tracker.</Empty>;
	let body: ReactNode;
	if (error) body = <Empty>{error}</Empty>;
	else if (!view) body = <Empty>Loading campaigns…</Empty>;
	else if (!view.file) body = <Empty>This project has no <code>docs/departments.md</code>. Departments are the perspectives you track the project from; each ranks its campaigns, with good-enough bars and the issues they track.</Empty>;
	else body = (
		<div className="mx-auto flex max-w-6xl flex-col gap-8 p-4">
			{view.exceptions.length ? (
				<div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
					{view.exceptions.map((x) => (
						<div key={x.root + x.node} className="flex items-center gap-2">
							<Icon name="TriangleAlert" className="size-4 text-amber-600" />
							<span className="flex-1">Reconciler exception on <b>{title(x.node)}</b> in {title(x.root)}</span>
							{x.ownerThread ? <Button size="sm" variant="outline" onClick={() => openThread(x.ownerThread!)}>Open owner</Button> : null}
						</div>
					))}
				</div>
			) : null}
			{view.departments.map((d) => <Department key={d.key} d={d} view={view} history={view.history} discuss={about} openIssue={openIssue} openThread={openThread} />)}
			<section className="flex flex-col gap-2">
				<div className="flex items-center gap-2 border-b border-border pb-1.5">
					<h2 className="flex-1 text-base font-semibold">Not in any campaign <span className="text-sm font-normal text-muted-foreground tabular-nums">{view.loose.length}</span></h2>
					<Button size="sm" variant="outline" disabled={!view.loose.length} onClick={() => setDiscuss({ targets: [{ provider: CAMPAIGN_MENTION, id: "loose:all", label: "untracked issues" }], heading: "Triage untracked issues", description: "A new thread that proposes, for each open issue no campaign tracks, the campaign that should track it." })}><Icon name="ListTree" />Triage</Button>
					<Button size="sm" variant="ghost" onClick={() => setShowLoose((s) => !s)}>{showLoose ? "Hide" : "Show"}</Button>
				</div>
				{showLoose ? (
					<ul className="columns-1 text-sm md:columns-2">
						{view.loose.map((slug) => <li key={slug}><button type="button" onClick={() => openIssue(slug)} className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-state-hover">{title(slug)}</button></li>)}
					</ul>
				) : null}
			</section>
		</div>
	);
	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
				<select className="h-8 rounded-md border border-input bg-transparent px-2 text-sm" value={projectId ?? ""} onChange={(e) => navigate.toPluginPanel("campaigns", { subPath: e.target.value })} aria-label="Project">
					{projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
				</select>
				<span className="ml-auto text-xs text-muted-foreground">
					{view?.facts.error ? <span className="text-red-600" title={view.facts.error}>facts failed · </span> : null}
					{view?.facts.command ? (view.facts.at ? "facts " + new Date(view.facts.at).toLocaleTimeString() : "reading facts…") : ""}
					{view && !view.history ? " · reading history…" : ""}
				</span>
				<Button size="sm" variant="ghost" disabled={busy || !view} onClick={refresh}><Icon name="RefreshCw" className={cn(busy && "animate-spin")} />Refresh</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
			{discuss && projectId ? <DiscussDialog projectId={projectId} targets={discuss.targets} heading={discuss.heading} description={discuss.description} onOpenChange={(o) => { if (!o) setDiscuss(null); }} /> : null}
		</div>
	);
}
