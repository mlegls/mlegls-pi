// Memory systems: disjoint, configurable systems for what a session remembers and how its context
// is built. Several are on at once as long as they don't overlap: each declares the surfaces it
// owns exclusively (`owns`: "compaction" is what a compaction is, "context" is how each request's
// messages are built). OM, journal and optmem each own compaction, so they are alternatives;
// optmem also owns context, as does elide (a policy over pi's own context); a system owning
// nothing (notes) composes with anything. Tools and prompt sections stack.
//
// Which systems are on is a list: settings `memory.systems`, overridden per session by `/memory`
// (a `cursor` record, so it follows the branch and forks inherit it). Two listed systems that own
// the same surface are an error: the later one stays off and the error is shown. `/memory <name>`
// turns name on and every listed system overlapping it off (so `/memory om` and `/memory optmem`
// swap whole harness behaviors); `+name` and `-name` turn one on or off. With no list, the on
// systems are `memory.default` (else the first enabled compaction owner) plus every enabled system
// overlapping none of those. An on system's tools are declared (an off one's withdrawn), its
// prompt section appended, its `context` builds each request and its `request` edits the provider
// payload. Systems with hooks of their own gate them on `isActive`.
//
// At compaction the active compaction owner may `prepare` first (e.g. write records with a model
// call); if that fails, the next enabled one renders instead (lib/records/render renderers), and
// with none left pi's native summarizer runs. The section's details are the compaction's details.
//
// Claims are also checked across extensions (each announces them on the event bus as
// `memory:roles`) and against upstream pi-observational-memory, which predates claims and is
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
	/** What the system's prepare returned, if it has one. */
	prepared?: unknown;
}

export interface Prepared {
	/** Overrides pi's cut point. */
	firstKeptEntryId?: string;
	[key: string]: unknown;
}

export interface Mechanism {
	/** Defaults to the renderer's name. */
	name?: string;
	/** Surfaces owned exclusively; defaults to ["compaction"] with a renderer, else none. */
	owns?: string[];
	/** What it renders at compaction (with "compaction" owned). */
	renderer?: Renderer<CompactionView, any>;
	budget?(): number;
	/** Tools declared only while this system is active. */
	tools?: string[];
	/** A section appended to the system prompt while active. */
	prompt?(event: BeforeAgentStartEvent, ctx: ExtensionContext): Promise<string | undefined> | string | undefined;
	/** Builds each request's messages while active (runs after every other context hook). */
	context?(messages: AgentMessage[], ctx: ExtensionContext): Promise<AgentMessage[] | undefined> | AgentMessage[] | undefined;
	/** Edits the provider payload while active; returns a replacement or undefined. */
	request?(payload: unknown, ctx: ExtensionContext): unknown;
	/** Usable in this cwd (settings); a disabled system is neither active nor a fallback. */
	enabled?(ctx: ExtensionContext): boolean;
	/** Async work before rendering. Throwing falls through to the next system. */
	prepare?(event: SessionBeforeCompactEvent, ctx: ExtensionContext): Promise<Prepared | undefined>;
	/** false: this system is already compacting; the duplicate is cancelled. */
	begin?(ctx: ExtensionContext): boolean;
	end?(): void;
}

type System = Mechanism & { name: string; owns: string[] };

interface RoleClaim { role: string; name: string; owner: string }

const LIST_KEY = "memory.systems";
const MODE_KEY = "memory.mode"; // before lists: one chosen system
let registered: System[] = [];

function readSettings(cwd: string): Record<string, any> {
	let out: Record<string, any> = {};
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try { out = { ...out, ...JSON.parse(readFileSync(path, "utf8")) }; } catch {}
	}
	return out;
}

const enabled = (ctx: ExtensionContext) => registered.filter((m) => m.enabled?.(ctx) ?? true);
type Claims = { name: string; owns: string[] };
const shared = (a: Claims, b: Claims) => a.owns.find((o) => b.owns.includes(o));

/** With no list: the chosen system (else the first compaction owner), then every one overlapping none already in. */
export function defaults<S extends Claims>(available: S[], chosen: string | undefined): S[] {
	const first = available.find((s) => s.name === chosen) ?? available.find((s) => s.owns.includes("compaction"));
	const out: S[] = first ? [first] : [];
	for (const s of available) if (!out.includes(s) && !out.some((a) => shared(a, s))) out.push(s);
	return out;
}

/** The on systems for a list (in its order), and an error for each listed system that can't be on. */
export function resolve<S extends Claims>(available: S[], all: Claims[], list: string[] | undefined, chosen?: string): { on: S[]; errors: string[] } {
	if (!list) return { on: defaults(available, chosen), errors: [] };
	const on: S[] = [], errors: string[] = [];
	for (const name of list) {
		const s = available.find((x) => x.name === name);
		if (!s) { errors.push(all.some((x) => x.name === name) ? name + " is disabled in settings" : "no memory system named " + name); continue; }
		const clash = on.find((a) => shared(a, s));
		if (clash) errors.push(name + " and " + clash.name + " both own " + shared(clash, s) + ": " + name + " is off");
		else on.push(s);
	}
	return { on, errors };
}

/** The listed systems: this branch's `/memory` list, else settings. */
function listed(ctx: ExtensionContext): string[] | undefined {
	const list = readCursor<string[]>(ctx.sessionManager as unknown as BranchSession, LIST_KEY) ?? readSettings(ctx.cwd).memory?.systems;
	return Array.isArray(list) ? list : undefined;
}

function state(ctx: ExtensionContext) {
	const chosen = readCursor<string>(ctx.sessionManager as unknown as BranchSession, MODE_KEY) ?? readSettings(ctx.cwd).memory?.default;
	return resolve(enabled(ctx), registered, listed(ctx), chosen);
}

export const activeSystems = (ctx: ExtensionContext): System[] => state(ctx).on;

/** The name of the active system owning a surface (default "compaction"), if any. */
export function activeMechanism(ctx: ExtensionContext, surface = "compaction"): string | undefined {
	return activeSystems(ctx).find((s) => s.owns.includes(surface))?.name;
}

export const isActive = (name: string, ctx: ExtensionContext) => activeSystems(ctx).some((s) => s.name === name);

/** Packages in global and project settings that are known to own a surface without declaring it. */
function undeclared(cwd: string): RoleClaim[] {
	const out: RoleClaim[] = [];
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, ".pi", "settings.json")]) {
		if (!existsSync(path)) continue;
		try {
			const packages = (JSON.parse(readFileSync(path, "utf8")).packages ?? []) as unknown[];
			for (const p of packages) {
				const source = typeof p === "string" ? p : (p as { source?: string })?.source;
				if (source?.includes("pi-observational-memory")) out.push({ role: "compaction", name: "pi-observational-memory", owner: source });
			}
		} catch {}
	}
	return out;
}

/** Same-surface claims from different owners, as warning lines. */
export function conflicts(claims: RoleClaim[]): string[] {
	const byRole = new Map<string, RoleClaim[]>();
	for (const c of claims) byRole.set(c.role, [...(byRole.get(c.role) ?? []), c]);
	return [...byRole].filter(([, cs]) => new Set(cs.map((c) => c.owner)).size > 1)
		.map(([role, cs]) => `${cs.length} memory systems claim "${role}": ${cs.map((c) => `${c.name} (${c.owner})`).join(", ")}`);
}

export function registerMechanisms(pi: ExtensionAPI, mechanisms: Mechanism[]): void {
	const systems: System[] = registered = mechanisms.map((m) => Object.assign(m, {
		name: m.name ?? m.renderer?.name ?? "unnamed",
		owns: m.owns ?? (m.renderer ? ["compaction"] : []),
	}));
	const owner = import.meta.url; // a second copy of this package loaded from elsewhere is a different owner
	const mine: RoleClaim[] = systems.flatMap((m) => m.owns.map((role) => ({ role, name: m.name, owner })));
	const others: RoleClaim[] = [];
	pi.events.on("memory:roles", (claims) => {
		for (const c of claims as RoleClaim[]) if (c.owner !== owner) others.push(c);
	});
	/** Declare the active systems' tools, withdraw the others'. */
	const syncTools = (ctx: ExtensionContext) => {
		const owned = new Set(systems.flatMap((m) => m.tools ?? []));
		const want = new Set(activeSystems(ctx).flatMap((m) => m.tools ?? []));
		const current = pi.getActiveTools();
		const next = [...current.filter((n) => !owned.has(n) || want.has(n)), ...[...want].filter((n) => !current.includes(n))];
		if (next.length !== current.length || next.some((n, i) => n !== current[i])) pi.setActiveTools(next);
	};
	pi.on("session_tree", (_event, ctx) => syncTools(ctx));
	pi.on("before_agent_start", async (event, ctx) => {
		syncTools(ctx);
		const sections: string[] = [];
		for (const s of activeSystems(ctx)) { const t = await s.prompt?.(event, ctx); if (t) sections.push(t); }
		return sections.length ? { systemPrompt: event.systemPrompt + "\n\n" + sections.join("\n\n") } : undefined;
	});
	pi.on("context", async (event, ctx) => {
		let messages: AgentMessage[] | undefined;
		for (const s of activeSystems(ctx)) messages = (await s.context?.(messages ?? event.messages, ctx)) ?? messages;
		return messages ? { messages } : undefined;
	});
	pi.on("before_provider_request", (event, ctx) => {
		let payload: unknown;
		for (const s of activeSystems(ctx)) payload = s.request?.(payload ?? event.payload, ctx) ?? payload;
		return payload;
	});

	pi.on("session_start", (_event, ctx) => {
		syncTools(ctx);
		pi.events.emit("memory:roles", mine);
		for (const e of state(ctx).errors) {
			if (ctx.hasUI) ctx.ui.notify("Memory: " + e, "error");
			else console.error("Memory: " + e);
		}
		const warnings = conflicts([...mine, ...others, ...undeclared(ctx.cwd)]);
		for (const w of warnings) {
			if (ctx.hasUI) ctx.ui.notify(w, "warning");
			else console.warn(w);
		}
	});

	const describe = (ctx: ExtensionContext) => {
		const { on, errors } = state(ctx), off = systems.filter((s) => !on.includes(s));
		return "Memory: " + (on.map((s) => s.name + (s.owns.length ? " (" + s.owns.join(", ") + ")" : "")).join(" + ") || "none (pi native)")
			+ (off.length ? "; off: " + off.map((s) => s.name).join(", ") : "") + errors.map((e) => "\nerror: " + e).join("");
	};
	pi.registerCommand("memory", {
		description: "Show or change this session's memory systems: /memory [name | +name | -name]",
		getArgumentCompletions: (prefix: string) => {
			const sign = /^[+-]/.test(prefix) ? prefix[0]! : "";
			return systems.map((m) => sign + m.name).filter((n) => n.startsWith(prefix)).map((n) => ({ value: n, label: n }));
		},
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (arg) {
				const sign = /^[+-]/.test(arg) ? arg[0] : "", name = arg.slice(sign.length);
				const s = systems.find((m) => m.name === name);
				if (!s) { ctx.ui.notify("Memory: no system named " + name + " (" + systems.map((m) => m.name).join(", ") + ")", "warning"); return; }
				const current = state(ctx).on.map((m) => m.name);
				let next: string[];
				if (sign === "-") next = current.filter((n) => n !== name);
				else if (sign === "+") {
					const clash = state(ctx).on.find((a) => a !== s && shared(a, s));
					if (clash) { ctx.ui.notify("Memory: " + name + " and " + clash.name + " both own " + shared(clash, s) + "; use /memory " + name + " to swap", "error"); return; }
					next = current.includes(name) ? current : [...current, name];
				} else next = [name, ...state(ctx).on.filter((a) => a !== s && !shared(a, s)).map((m) => m.name)];
				writeCursor(ctx.sessionManager as unknown as BranchSession, LIST_KEY, next);
				syncTools(ctx);
			}
			ctx.ui.notify(describe(ctx), state(ctx).errors.length ? "warning" : "info");
		},
	});

	pi.on("session_before_compact", async (event: SessionBeforeCompactEvent, ctx: ExtensionContext) => {
		const usable = enabled(ctx).filter((m) => m.renderer && m.owns.includes("compaction"));
		const active = activeMechanism(ctx);
		const order = [...usable.filter((m) => m.name === active), ...usable.filter((m) => m.name !== active)];
		const { firstKeptEntryId, tokensBefore } = event.preparation;
		for (const m of order) {
			if (m.begin && !m.begin(ctx)) {
				if (ctx.hasUI) ctx.ui.notify(`Memory (${m.name}): another compaction is already in progress; cancelling duplicate`, "warning");
				return { cancel: true };
			}
			try {
				let prepared: Prepared | undefined;
				if (m.prepare) {
					try {
						prepared = await m.prepare(event, ctx);
					} catch (error) {
						if (event.signal.aborted) return { cancel: true };
						const next = order[order.indexOf(m) + 1]?.name ?? "pi native";
						if (ctx.hasUI) ctx.ui.notify(`Memory (${m.name}): ${error instanceof Error ? error.message : String(error)}; falling back to ${next}`, "warning");
						continue;
					}
				}
				const keep = prepared?.firstKeptEntryId ?? firstKeptEntryId;
				const view: CompactionView = { session: ctx.sessionManager as BranchSession, branch: event.branchEntries as { id: string }[], firstKeptEntryId: keep, prepared };
				const s = render(m.renderer!, view, m.budget?.() ?? Infinity);
				if (s) return { compaction: { summary: s.text, firstKeptEntryId: keep, tokensBefore, details: s.details } };
			} finally {
				m.end?.();
			}
		}
		return;
	});
}
