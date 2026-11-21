// Pi Memory page: pick a notes log or a life on the left; the right shows what an agent wakes to
// (the notes cover, or the life's shared view), one line per block. A block opens into the blocks
// under it, down to single notes or messages.
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { definePluginApp, useRpc } from "@get-bb/plugin-sdk/app";
import type { LifeLine, LifeMessage, NoteLine, rpcContract } from "./server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Rpc = ReturnType<typeof useRpc<typeof rpcContract>>;
type Selection = { kind: "notes"; log: string } | { kind: "life"; id: string };
const KEY = "pi-memory:selection";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
const day = (ts?: string) => (ts ? ts.slice(0, 16).replace("T", " ") : "");

function Status({ children }: { children: ReactNode }) {
	return <div role="status" className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</div>;
}

/** A row that, when it covers more than one item, opens into its children on click. */
function Row({ label, meta, text, dim, open, onToggle, children }: {
	label: string; meta?: string; text: string; dim?: boolean; open?: boolean; onToggle?: () => void; children?: ReactNode;
}) {
	return (
		<li className="py-1">
			<div
				className={cn("flex gap-2 rounded px-1 text-sm", onToggle && "cursor-pointer hover:bg-accent")}
				onClick={onToggle}
			>
				<span className="w-3 shrink-0 text-muted-foreground">{onToggle ? (open ? "▾" : "▸") : ""}</span>
				<span className="w-20 shrink-0 font-mono text-xs leading-5 text-muted-foreground">{label}</span>
				<span className={cn("min-w-0 flex-1 whitespace-pre-wrap break-words", dim && "italic text-muted-foreground")}>{text}</span>
				{meta ? <span className="hidden shrink-0 font-mono text-xs leading-5 text-muted-foreground md:inline">{meta}</span> : null}
			</div>
			{open && children ? <ul className="ml-4 border-l border-border pl-2">{children}</ul> : null}
		</li>
	);
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
	const [state, setState] = useState<{ data?: T; error?: string }>({});
	const reload = useCallback(() => { load().then((data) => setState({ data }), (e) => setState({ error: errorText(e) })); }, deps);
	useEffect(() => { setState({}); reload(); }, [reload]);
	return { ...state, reload };
}

function NoteRow({ rpc, log, line }: { rpc: Rpc; log: string; line: NoteLine }) {
	const [open, setOpen] = useState(false);
	const [kids, setKids] = useState<NoteLine[] | string>();
	const block = line.hi - line.lo > 1;
	const toggle = () => {
		if (!open && !kids) rpc.call("notesZoom", { log, lo: line.lo, hi: line.hi }).then((r) => setKids(r.lines), (e) => setKids(errorText(e)));
		setOpen(!open);
	};
	return (
		<Row label={block ? "#" + line.lo + "-" + (line.hi - 1) : "#" + line.lo} meta={day(line.ts)} text={line.text}
			dim={block && !line.summarized} open={open} onToggle={block ? toggle : undefined}>
			{kids === undefined ? <li className="text-xs text-muted-foreground">loading…</li>
				: typeof kids === "string" ? <li className="text-xs text-destructive">{kids}</li>
				: kids.map((k) => <NoteRow key={k.lo + "-" + k.hi} rpc={rpc} log={log} line={k} />)}
		</Row>
	);
}

function NotesView({ rpc, log }: { rpc: Rpc; log: string }) {
	const { data, error, reload } = useLoad(() => rpc.call("notes", { log }), [rpc, log]);
	const [all, setAll] = useState(false);
	if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
	if (!data) return <Status>Loading…</Status>;
	const lines = all ? data.notes : data.wake;
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<h2 className="min-w-0 flex-1 truncate font-medium">{data.label}</h2>
				<Button size="sm" variant={all ? "ghost" : "secondary"} onClick={() => setAll(false)}>Wake ({data.wake.length}/{data.budget} lines)</Button>
				<Button size="sm" variant={all ? "secondary" : "ghost"} onClick={() => setAll(true)}>All {data.count} notes</Button>
				<Button size="sm" variant="ghost" onClick={reload}>Refresh</Button>
			</div>
			{lines.length ? <ul>{lines.map((l) => <NoteRow key={l.lo + "-" + l.hi} rpc={rpc} log={log} line={l} />)}</ul> : <Status>No notes yet.</Status>}
		</div>
	);
}

function MessageView({ m }: { m: LifeMessage }) {
	return (
		<li className="py-1 text-sm">
			<div className="font-mono text-xs text-muted-foreground">{m.kind}@{m.place} · {day(m.date)} · {m.model} · {m.source}</div>
			<div className="whitespace-pre-wrap break-words">{m.text}</div>
		</li>
	);
}

function LifeRow({ rpc, id, line }: { rpc: Rpc; id: string; line: LifeLine }) {
	const [open, setOpen] = useState(false);
	const [kids, setKids] = useState<{ lines?: LifeLine[]; message?: LifeMessage } | string>();
	const toggle = () => {
		if (!open && !kids) rpc.call("lifeZoom", { id, first: line.first, n: line.n }).then(setKids, (e) => setKids(errorText(e)));
		setOpen(!open);
	};
	return (
		<Row label={line.first + "+" + line.n} meta={day(line.date)} text={line.stub ? "(stub) " + line.text : line.text}
			dim={!line.built || line.stub} open={open} onToggle={toggle}>
			{kids === undefined ? <li className="text-xs text-muted-foreground">loading…</li>
				: typeof kids === "string" ? <li className="text-xs text-destructive">{kids}</li>
				: kids.message ? <MessageView m={kids.message} />
				: (kids.lines ?? []).map((k) => <LifeRow key={k.first + "+" + k.n} rpc={rpc} id={id} line={k} />)}
		</Row>
	);
}

function LifeView({ rpc, id }: { rpc: Rpc; id: string }) {
	const { data, error, reload } = useLoad(() => rpc.call("life", { id }), [rpc, id]);
	if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
	if (!data) return <Status>Loading…</Status>;
	const live = data.places.filter((p) => !p.ended || p.hold);
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<h2 className="min-w-0 flex-1 truncate font-medium">{id}</h2>
				<span className="text-xs text-muted-foreground">{data.T} messages · {data.view.length} lines · fanout {data.b}</span>
				<Button size="sm" variant="ghost" onClick={reload}>Refresh</Button>
			</div>
			{live.length ? (
				<div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
					<div className="mb-1 text-xs font-medium text-muted-foreground">Present</div>
					{live.map((p) => (
						<div key={p.thread ?? p.session} className="flex gap-2">
							<span className="font-mono text-xs leading-5 text-muted-foreground">{p.thread ?? "session:" + p.session.slice(0, 8)}</span>
							<span>{p.ended ? "ended" : "running since " + day(p.time)}{p.hold ? " — holding: " + p.hold : ""}</span>
						</div>
					))}
				</div>
			) : null}
			{data.view.length ? <ul>{data.view.map((l) => <LifeRow key={l.first + "+" + l.n} rpc={rpc} id={id} line={l} />)}</ul> : <Status>No messages yet.</Status>}
		</div>
	);
}

function MemoryPage() {
	const rpc = useRpc<typeof rpcContract>();
	const index = useLoad(() => rpc.call("index"), [rpc]);
	const [sel, setSel] = useState<Selection | null>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } });
	const pick = (s: Selection) => { setSel(s); localStorage.setItem(KEY, JSON.stringify(s)); };
	const item = (active: boolean, title: string, sub: string, onClick: () => void, key: string) => (
		<li key={key}>
			<button type="button" onClick={onClick} className={cn("w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent", active && "bg-accent")}>
				<div className="truncate">{title}</div>
				<div className="text-xs text-muted-foreground">{sub}</div>
			</button>
		</li>
	);
	return (
		<div className="flex h-full min-h-0 flex-1">
			<aside className="w-60 shrink-0 overflow-y-auto border-r border-border p-2">
				{index.error ? <p className="text-sm text-destructive">{index.error}</p> : !index.data ? <Status>Loading…</Status> : (
					<>
						<div className="px-2 pb-1 pt-2 text-xs font-medium uppercase text-muted-foreground">Notes</div>
						<ul>{index.data.notes.map((n) => item(sel?.kind === "notes" && sel.log === n.log, n.label, n.count + " notes · " + day(n.last),
							() => pick({ kind: "notes", log: n.log }), n.log))}</ul>
						<div className="px-2 pb-1 pt-4 text-xs font-medium uppercase text-muted-foreground">Lives</div>
						<ul>{index.data.lives.map((l) => item(sel?.kind === "life" && sel.id === l.id, l.label, l.messages + " messages · " + day(l.last),
							() => pick({ kind: "life", id: l.id }), l.id))}</ul>
					</>
				)}
			</aside>
			<main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-5">
				<div className="mx-auto w-full max-w-4xl">
					{!sel ? <Status>Pick a notes log or a life.</Status>
						: sel.kind === "notes" ? <NotesView key={sel.log} rpc={rpc} log={sel.log} />
						: <LifeView key={sel.id} rpc={rpc} id={sel.id} />}
				</div>
			</main>
		</div>
	);
}

export default definePluginApp((app) => {
	app.slots.navPanel({ id: "memory", title: "Pi memory", icon: "Brain", path: "memory", component: MemoryPage });
});
