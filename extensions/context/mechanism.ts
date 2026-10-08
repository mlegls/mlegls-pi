// Memory mechanisms: disjoint, configurable systems for what a session remembers and how its
// context is built (lib/records/render renderers, plus whatever harness surface they own). A
// session has one active mechanism: `/memory <name>` switches it (a `cursor` record, so it follows
// the branch and forks inherit it), else settings `memory.default`, else the first enabled one.
// Switching swaps the whole system: only the active mechanism's tools are declared, its prompt
// section appended, its `context` builds each request and its `request` edits the provider payload.
//
// At compaction the active mechanism may `prepare` first (e.g. write records with a model call); if that fails, the next
// enabled mechanism renders instead, and with none left pi's native summarizer runs. The section's
// details are the compaction's details. Mechanisms gate their own compaction triggers on
// `isActive`, so only the active one triggers, while any may keep observing in the background.
//
// Renderers declare a role; mechanisms in this list are alternatives for their role, so the
// conflict check is across extensions (each announces its roles on the event bus as
// `memory:roles`) and against upstream pi-observational-memory, which predates roles and is
// recognized by its package in settings.
import { getAgentDir, type BeforeAgentStartEvent, type ExtensionAPI, type ExtensionContext, type SessionBeforeCompactEvent } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BranchSession } from "../../lib/records/branch.ts";
import { readCursor, writeCursor } from "../../lib/records/cursor.ts";
import { render, type Renderer } from "../../lib/records/render.ts";

export interface CompactionView {
	session: BranchSession;
	/** The branch being compacted (pi's event.branchEntries). */
	branch: { id: string }[];
	firstKeptEntryId: string;
	/** What the mechanism's prepare returned, if it has one. */
	prepared?: unknown;
}

export interface Prepared {
	/** Overrides pi's cut point. */
	firstKeptEntryId?: string;
	[key: string]: unknown;
}

export interface Mechanism {
	renderer: Renderer<CompactionView, any>;
	/** Tools declared only while this mechanism is active. */
	tools?: string[];
	/** A section appended to the system prompt while active. */
	prompt?(event: BeforeAgentStartEvent, ctx: ExtensionContext): Promise<string | undefined> | string | undefined;
	/** Builds each request's messages while active (runs after every other context hook). */
	context?(messages: AgentMessage[], ctx: ExtensionContext): AgentMessage[] | undefined;
	/** Edits the provider payload while active; returns a replacement or undefined. */
	request?(payload: unknown, ctx: ExtensionContext): unknown;
	budget(): number;
	/** Usable in this cwd (settings); a disabled mechanism is neither active nor a fallback. */
	enabled?(ctx: ExtensionContext): boolean;
	/** Async work before rendering. Throwing falls through to the next mechanism. */
	prepare?(event: SessionBeforeCompactEvent, ctx: ExtensionContext): Promise<Prepared | undefined>;
	/** false: this mechanism is already compacting; the duplicate is cancelled. */
	begin?(ctx: ExtensionContext): boolean;
	end?(): void;
}

interface RoleClaim { role: string; name: string; owner: string }

const MODE_KEY = "memory.mode";
let registered: Mechanism[] = [];

function readSettings(cwd: string): Record<string, any> {
	let out: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { out = { ...out, ...JSON.parse(readFileSync(path, "utf8")) }; } catch {}
	}
	return out;
}

const enabled = (ctx: ExtensionContext) => registered.filter((m) => m.enabled?.(ctx) ?? true);

/** The session's active mechanism name, if any is enabled. */
export function activeMechanism(ctx: ExtensionContext): string | undefined {
	const names = enabled(ctx).map((m) => m.renderer.name);
	const chosen = readCursor<string>(ctx.sessionManager as unknown as BranchSession, MODE_KEY);
	if (chosen && names.includes(chosen)) return chosen;
	const fallback = readSettings(ctx.cwd).memory?.default;
	return names.includes(fallback) ? fallback : names[0];
}

export const isActive = (name: string, ctx: ExtensionContext) => activeMechanism(ctx) === name;

const active = (ctx: ExtensionContext) => { const name = activeMechanism(ctx); return registered.find((m) => m.renderer.name === name); };

/** Whether the active mechanism builds requests itself (so other context policies stand aside). */
export const ownsContext = (ctx: ExtensionContext) => !!active(ctx)?.context;

/** Packages in global and project settings that are known to render a role without declaring it. */
function undeclared(cwd: string): RoleClaim[] {
	const out: RoleClaim[] = [];
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try {
			const packages = (JSON.parse(readFileSync(path, "utf8")).packages ?? []) as unknown[];
			for (const p of packages) {
				const source = typeof p === "string" ? p : (p as { source?: string })?.source;
				if (source?.includes("pi-observational-memory")) out.push({ role: "memory", name: "pi-observational-memory", owner: source });
			}
		} catch {}
	}
	return out;
}

/** Same-role claims from different owners, as warning lines. */
export function conflicts(claims: RoleClaim[]): string[] {
	const byRole = new Map<string, RoleClaim[]>();
	for (const c of claims) byRole.set(c.role, [...(byRole.get(c.role) ?? []), c]);
	return [...byRole].filter(([, cs]) => new Set(cs.map((c) => c.owner)).size > 1)
		.map(([role, cs]) => `${cs.length} memory mechanisms claim role "${role}": ${cs.map((c) => `${c.name} (${c.owner})`).join(", ")}`);
}

export function registerMechanisms(pi: ExtensionAPI, mechanisms: Mechanism[]): void {
	registered = mechanisms;
	const owner = import.meta.url; // a second copy of this package loaded from elsewhere is a different owner
	const mine: RoleClaim[] = mechanisms.map((m) => ({ role: m.renderer.role, name: m.renderer.name, owner }));
	const others: RoleClaim[] = [];
	pi.events.on("memory:roles", (claims) => {
		for (const c of claims as RoleClaim[]) if (c.owner !== owner) others.push(c);
	});
	/** Declare the active mechanism's tools, withdraw the others'. */
	const syncTools = (ctx: ExtensionContext) => {
		const on = active(ctx);
		const owned = new Set(mechanisms.flatMap((m) => m.tools ?? []));
		const want = new Set(on?.tools ?? []);
		const current = pi.getActiveTools();
		const next = [...current.filter((n) => !owned.has(n) || want.has(n)), ...[...want].filter((n) => !current.includes(n))];
		if (next.length !== current.length || next.some((n, i) => n !== current[i])) pi.setActiveTools(next);
	};
	pi.on("session_tree", (_event, ctx) => syncTools(ctx));
	pi.on("before_agent_start", async (event, ctx) => {
		syncTools(ctx);
		const section = await active(ctx)?.prompt?.(event, ctx);
		return section ? { systemPrompt: event.systemPrompt + "\n\n" + section } : undefined;
	});
	pi.on("context", (event, ctx) => {
		const messages = active(ctx)?.context?.(event.messages, ctx);
		return messages ? { messages } : undefined;
	});
	pi.on("before_provider_request", (event, ctx) => active(ctx)?.request?.(event.payload, ctx));

	pi.on("session_start", (_event, ctx) => {
		syncTools(ctx);
		pi.events.emit("memory:roles", mine);
		const warnings = conflicts([...mine, ...others, ...undeclared(ctx.cwd)]);
		for (const w of warnings) {
			if (ctx.hasUI) ctx.ui.notify(w, "warning");
			else console.warn(w);
		}
	});

	pi.registerCommand("memory", {
		description: "Show or switch this session's memory mechanism: /memory [name]",
		getArgumentCompletions: (prefix: string) => mechanisms.map((m) => m.renderer.name).filter((n) => n.startsWith(prefix)).map((n) => ({ value: n, label: n })),
		handler: async (args, ctx) => {
			const want = args.trim();
			const names = enabled(ctx).map((m) => m.renderer.name);
			if (want) {
				if (!names.includes(want)) { ctx.ui.notify(`Memory: "${want}" is not an enabled mechanism (${names.join(", ") || "none"})`, "warning"); return; }
				writeCursor(ctx.sessionManager as unknown as BranchSession, MODE_KEY, want);
				syncTools(ctx);
			}
			const active = activeMechanism(ctx);
			ctx.ui.notify(`Memory: ${active ?? "none (pi native)"}${names.length > 1 ? ` (enabled: ${names.join(", ")})` : ""}`, "info");
		},
	});

	pi.on("session_before_compact", async (event: SessionBeforeCompactEvent, ctx: ExtensionContext) => {
		const usable = enabled(ctx);
		const active = activeMechanism(ctx);
		const order = [...usable.filter((m) => m.renderer.name === active), ...usable.filter((m) => m.renderer.name !== active)];
		const { firstKeptEntryId, tokensBefore } = event.preparation;
		for (const m of order) {
			if (m.begin && !m.begin(ctx)) {
				if (ctx.hasUI) ctx.ui.notify(`Memory (${m.renderer.name}): another compaction is already in progress; cancelling duplicate`, "warning");
				return { cancel: true };
			}
			try {
				let prepared: Prepared | undefined;
				if (m.prepare) {
					try {
						prepared = await m.prepare(event, ctx);
					} catch (error) {
						if (event.signal.aborted) return { cancel: true };
						const next = order[order.indexOf(m) + 1]?.renderer.name ?? "pi native";
						if (ctx.hasUI) ctx.ui.notify(`Memory (${m.renderer.name}): ${error instanceof Error ? error.message : String(error)}; falling back to ${next}`, "warning");
						continue;
					}
				}
				const keep = prepared?.firstKeptEntryId ?? firstKeptEntryId;
				const view: CompactionView = { session: ctx.sessionManager as BranchSession, branch: event.branchEntries as { id: string }[], firstKeptEntryId: keep, prepared };
				const s = render(m.renderer, view, m.budget());
				if (s) return { compaction: { summary: s.text, firstKeptEntryId: keep, tokensBefore, details: s.details } };
			} finally {
				m.end?.();
			}
		}
		return;
	});
}
