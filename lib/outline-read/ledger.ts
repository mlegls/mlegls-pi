/** Session-wide line identities. Retired names remain reserved, including on resume. */
import { createHash } from "node:crypto";
import { diffArrays } from "diff";
import { allocateAnchor, AnchorSet, ANCHOR_CAPACITY, isAnchor } from "./anchors";

export interface AnchoredLine { anchor: string; text: string; }
export interface FileLedger { lines: AnchoredLine[]; }
export interface LedgerEntry {
	path: string;
	hash: string;
	anchors: string[];
	/** Names no longer live, but still potentially present in model context. */
	retired?: string[];
}
export interface LineEdit { start: number; end: number; lines: string[]; }

export function contentHash(lines: string[]): string {
	return createHash("sha1").update(lines.join("\n")).digest("hex").slice(0, 16);
}

/** Infer correspondence only inside the supplied region. Strings need new identities. */
function reconcile(previous: AnchoredLine[], current: string[]): (AnchoredLine | string)[] {
	const next: (AnchoredLine | string)[] = [];
	let index = 0;
	for (const part of diffArrays(previous.map(line => line.text), current)) {
		if (part.added) for (const text of part.value) next.push(text);
		else {
			if (!part.removed) for (let i = index; i < index + part.value.length; i++) next.push(previous[i]);
			index += part.value.length;
		}
	}
	return next;
}

export class Ledger {
	private files = new Map<string, FileLedger>();
	/** All issued names, not just live rows; also includes in-flight write reservations. */
	private taken = new AnchorSet();
	private issued = new Map<string, Set<string>>();
	private pending = new Map<string, LedgerEntry>();

	reset(): void {
		this.files.clear(); this.taken.clear(); this.issued.clear(); this.pending.clear();
	}
	find(anchor: string): { path: string; index: number } | undefined {
		for (const [path, ledger] of this.files) {
			const index = ledger.lines.findIndex(line => line.anchor === anchor);
			if (index >= 0) return { path, index };
		}
		return undefined;
	}
	pendingPaths(): string[] { return [...this.pending.keys()]; }
	restore(entry: LedgerEntry): void {
		const issued = this.issued.get(entry.path) ?? new Set<string>();
		const names = [...entry.anchors, ...(entry.retired ?? [])];
		const valid = names.every(isAnchor) && new Set(names).size === names.length
			&& names.every(name => !this.taken.has(name) || issued.has(name));
		// Reserve before any file is read: lazy restoration must not let other files steal names.
		for (const name of names) if (isAnchor(name) && (!this.taken.has(name) || issued.has(name))) {
			this.taken.add(name); issued.add(name);
		}
		this.issued.set(entry.path, issued);
		this.pending.set(entry.path, valid ? entry : { ...entry, anchors: [] });
	}
	get(path: string): FileLedger | undefined { return this.files.get(path); }
	known(path: string): boolean { return this.files.has(path) || this.pending.has(path); }

	/** Reserve all new names before writing. Failed writes release only never-published names. */
	private prepare(path: string, rows: (AnchoredLine | string)[]) {
		const count = rows.reduce((n, row) => n + Number(typeof row === "string"), 0);
		if (this.taken.size + count > ANCHOR_CAPACITY)
			throw new Error("Anchor capacity exhausted (" + ANCHOR_CAPACITY + " four-character names, including retired identities); start a new session.");
		const allocated: string[] = [];
		const fresh: number[] = [];
		const lines = rows.map((row, i) => {
			if (typeof row !== "string") return row;
			const anchor = allocateAnchor(row, this.taken, path);
			allocated.push(anchor); fresh.push(i);
			return { anchor, text: row };
		});
		let settled = false;
		return {
			lines, fresh,
			commit: () => {
				if (settled) throw new Error("Anchor update already settled");
				settled = true;
				const issued = this.issued.get(path) ?? new Set<string>();
				for (const anchor of allocated) issued.add(anchor);
				this.issued.set(path, issued);
				const ledger = { lines };
				this.files.set(path, ledger);
				return ledger;
			},
			rollback: () => {
				if (settled) return;
				settled = true;
				for (const anchor of allocated) this.taken.delete(anchor);
			},
		};
	}

	/** Edits are sorted, non-overlapping, and refer to the current ledger snapshot. */
	prepareEdits(path: string, edits: LineEdit[]) {
		const previous = this.files.get(path);
		if (!previous) throw new Error("Read the file before editing");
		const rows: (AnchoredLine | string)[] = [];
		let index = 0;
		for (const edit of edits) {
			for (let i = index; i < edit.start; i++) rows.push(previous.lines[i]);
			for (const row of reconcile(previous.lines.slice(edit.start, edit.end), edit.lines)) rows.push(row);
			index = edit.end;
		}
		for (let i = index; i < previous.lines.length; i++) rows.push(previous.lines[i]);
		return this.prepare(path, rows);
	}

	sync(path: string, current: string[]): { ledger: FileLedger; changed: boolean; fresh: number[] } {
		const ledger = this.files.get(path);
		const pending = this.pending.get(path);
		if (!ledger && pending && pending.hash === contentHash(current) && pending.anchors.length === current.length) {
			const restored = { lines: current.map((text, i) => ({ anchor: pending.anchors[i], text })) };
			this.pending.delete(path);
			this.files.set(path, restored);
			return { ledger: restored, changed: false, fresh: [] };
		}
		if (ledger && ledger.lines.length === current.length && ledger.lines.every((line, i) => line.text === current[i]))
			return { ledger, changed: false, fresh: [] };
		const update = this.prepare(path, ledger ? reconcile(ledger.lines, current) : current);
		const next = update.commit();
		this.pending.delete(path);
		return { ledger: next, changed: true, fresh: update.fresh };
	}
	indexOf(path: string, anchor: string): number {
		return this.files.get(path)?.lines.findIndex(line => line.anchor === anchor) ?? -1;
	}
	entry(path: string): LedgerEntry | undefined {
		const ledger = this.files.get(path);
		if (!ledger) return undefined;
		const anchors = ledger.lines.map(line => line.anchor);
		const live = new Set(anchors);
		const retired = [...this.issued.get(path) ?? []].filter(anchor => !live.has(anchor));
		return { path, hash: contentHash(ledger.lines.map(line => line.text)), anchors, retired };
	}
}
