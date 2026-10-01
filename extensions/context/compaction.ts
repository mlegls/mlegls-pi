// Compaction as a composition of renderers (lib/records/render): every active memory mechanism
// contributes a section, cut under its own budget, and the sections in order are the summary.
// The first section's details are the compaction's details (OM reads its own back from there);
// with more than one, each section's are also under details.sections. No section: pi's native
// summarizer runs instead. Any mechanism may trigger a compaction; all of them render into it.
//
// Renderers declare a role; two with the same role are a conflict, warned about at session
// start. Checked within this list, across extensions (each announces its roles on the event
// bus as `memory:roles`), and against upstream pi-observational-memory, which predates roles
// and is recognized by its package in settings.
import { getAgentDir, type ExtensionAPI, type ExtensionContext, type SessionBeforeCompactEvent } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BranchSession } from "../../lib/records/branch.ts";
import { render, type Renderer } from "../../lib/records/render.ts";

export interface CompactionView {
	session: BranchSession;
	/** The branch being compacted (pi's event.branchEntries). */
	branch: { id: string }[];
	firstKeptEntryId: string;
}

export interface CompactionMechanism {
	renderer: Renderer<CompactionView, any>;
	budget(): number;
	/** false: this mechanism is already compacting; the duplicate is cancelled. */
	begin?(ctx: ExtensionContext): boolean;
	end?(): void;
}

interface RoleClaim { role: string; name: string; owner: string }

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

/** Same-role claims, as warning lines. */
export function conflicts(claims: RoleClaim[]): string[] {
	const byRole = new Map<string, RoleClaim[]>();
	for (const c of claims) byRole.set(c.role, [...(byRole.get(c.role) ?? []), c]);
	return [...byRole].filter(([, cs]) => new Set(cs.map((c) => c.owner + "/" + c.name)).size > 1)
		.map(([role, cs]) => `${cs.length} memory mechanisms claim role "${role}": ${cs.map((c) => `${c.name} (${c.owner})`).join(", ")}`);
}

export function registerCompaction(pi: ExtensionAPI, mechanisms: CompactionMechanism[]): void {
	const owner = import.meta.url; // a second copy of this package loaded from elsewhere is a different owner
	const mine: RoleClaim[] = mechanisms.map((m) => ({ role: m.renderer.role, name: m.renderer.name, owner }));
	const others: RoleClaim[] = [];
	pi.events.on("memory:roles", (claims) => {
		for (const c of claims as RoleClaim[]) if (c.owner !== owner) others.push(c);
	});
	pi.on("session_start", (_event, ctx) => {
		pi.events.emit("memory:roles", mine);
		const warnings = conflicts([...mine, ...others, ...undeclared(ctx.cwd)]);
		for (const w of warnings) {
			if (ctx.hasUI) ctx.ui.notify(w, "warning");
			else console.warn(w);
		}
	});

	pi.on("session_before_compact", async (event: SessionBeforeCompactEvent, ctx: ExtensionContext) => {
		const begun: CompactionMechanism[] = [];
		try {
			for (const m of mechanisms) {
				if (m.begin && !m.begin(ctx)) {
					if (ctx.hasUI) ctx.ui.notify(`Memory (${m.renderer.name}): another compaction is already in progress; cancelling duplicate`, "warning");
					return { cancel: true };
				}
				begun.push(m);
			}
			const { firstKeptEntryId, tokensBefore } = event.preparation;
			const view: CompactionView = { session: ctx.sessionManager as BranchSession, branch: event.branchEntries as { id: string }[], firstKeptEntryId };
			const sections = mechanisms.flatMap((m) => {
				const s = render(m.renderer, view, m.budget());
				return s ? [{ name: m.renderer.name, ...s }] : [];
			});
			if (!sections.length) return;
			const first = sections[0]!.details;
			const details = sections.length === 1 ? first
				: { ...(first as object), sections: Object.fromEntries(sections.map((s) => [s.name, s.details])) };
			return { compaction: { summary: sections.map((s) => s.text).join("\n\n"), firstKeptEntryId, tokensBefore, details } };
		} finally {
			for (const m of begun) m.end?.();
		}
	});
}
