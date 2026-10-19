// The Campaigns page: docs/departments.md as the project's progress and planning view. Departments are the
// maintainer's perspectives; each ranks its campaigns, top-down views over the tracker with good-enough bars. The page
// only reads; its actions start threads (discuss a department, campaign or promise; triage what no campaign tracks)
// and jump to the issues and threads it shows.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBbNavigate, useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { CAMPAIGN_MENTION, CHANGED, WEEKS, title, type CampaignView, type Campaigns, type DepartmentView, type Level } from "./model";
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

/** Issues that reached done each week, oldest first. */
function Weekly({ weekly }: { weekly: number[] }) {
	const max = Math.max(1, ...weekly);
	return (
		<div className="flex h-6 items-end gap-px" title={"Done per week, last " + WEEKS + " weeks: " + weekly.join(", ")}>
			{weekly.map((n, i) => <div key={i} className={cn("w-1.5 rounded-sm", n ? "bg-emerald-500/80" : "bg-muted")} style={{ height: Math.max(2, (n / max) * 24) + "px" }} />)}
		</div>
	);
}

function CampaignCard({ c, history, onDiscuss, openIssue, openThread }: { c: CampaignView; history: boolean; onDiscuss: () => void; openIssue: (slug: string) => void; openThread: (id: string) => void }) {
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
				{history ? <Weekly weekly={c.weekly} /> : null}
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

function Department({ d, history, discuss, openIssue, openThread }: { d: DepartmentView; history: boolean; discuss: (t: Target, heading: string) => void; openIssue: (slug: string) => void; openThread: (id: string) => void }) {
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
					<CampaignCard key={c.key} c={c} history={history} openIssue={openIssue} openThread={openThread} onDiscuss={() => discuss(target("campaign", c.key, c.title), "Discuss " + c.title)} />
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
			{view.departments.map((d) => <Department key={d.key} d={d} history={view.history} discuss={about} openIssue={openIssue} openThread={openThread} />)}
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
