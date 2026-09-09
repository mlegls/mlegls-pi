/**
 * Per-session anchor ledger: for each file, the anchored lines as last seen.
 * Syncing against the current file keeps anchors for unchanged lines (by
 * line diff), allocates fresh ones for new lines, and frees the rest.
 * Persisted as session entries holding anchors plus a content hash, so a
 * resumed session restores anchors only when the file is byte-identical.
 */
import { createHash } from "node:crypto";
import { diffArrays } from "diff";
import { allocateAnchor } from "./anchors";

export interface AnchoredLine {
	anchor: string;
	text: string;
}

export interface FileLedger {
	lines: AnchoredLine[];
	taken: Set<string>;
}

export interface LedgerEntry {
	path: string;
	hash: string;
	anchors: string[];
}

export function contentHash(lines: string[]): string {
	return createHash("sha1").update(lines.join("\n")).digest("hex").slice(0, 16);
}

export class Ledger {
	private files = new Map<string, FileLedger>();
	/** Entries restored from the session, applied lazily on first sync. */
	private pending = new Map<string, LedgerEntry>();

	reset(): void {
		this.files.clear();
		this.pending.clear();
	}

	restore(entry: LedgerEntry): void {
		this.pending.set(entry.path, entry);
	}

	get(path: string): FileLedger | undefined {
		return this.files.get(path);
	}

	/** Whether anchors exist (or can be restored) for the file. */
	known(path: string): boolean {
		return this.files.has(path) || this.pending.has(path);
	}

	/**
	 * Reconcile with the file's current lines. `fresh` lists 0-indexed
	 * positions that received new anchors.
	 */
	sync(path: string, current: string[]): { ledger: FileLedger; changed: boolean; fresh: number[] } {
		let ledger = this.files.get(path);
		const pending = this.pending.get(path);
		if (!ledger && pending) {
			this.pending.delete(path);
			if (pending.hash === contentHash(current) && pending.anchors.length === current.length) {
				ledger = { lines: current.map((text, i) => ({ anchor: pending.anchors[i], text })), taken: new Set(pending.anchors) };
				this.files.set(path, ledger);
				return { ledger, changed: false, fresh: [] };
			}
		}
		if (!ledger) {
			const taken = new Set<string>();
			ledger = { lines: current.map((text) => ({ anchor: allocateAnchor(text, taken), text })), taken };
			this.files.set(path, ledger);
			return { ledger, changed: true, fresh: current.map((_, i) => i) };
		}
		const previous = ledger.lines.map((line) => line.text);
		if (previous.length === current.length && previous.every((text, i) => text === current[i])) {
			return { ledger, changed: false, fresh: [] };
		}
		const next: AnchoredLine[] = [];
		const fresh: number[] = [];
		let index = 0;
		for (const part of diffArrays(previous, current)) {
			if (part.removed) {
				for (const line of ledger.lines.slice(index, index + part.value.length)) ledger.taken.delete(line.anchor);
				index += part.value.length;
			} else if (part.added) {
				for (const text of part.value) {
					fresh.push(next.length);
					next.push({ anchor: allocateAnchor(text, ledger.taken), text });
				}
			} else {
				next.push(...ledger.lines.slice(index, index + part.value.length));
				index += part.value.length;
			}
		}
		ledger.lines = next;
		return { ledger, changed: true, fresh };
	}

	/** Position (0-indexed) of an anchor in the file, or -1. */
	indexOf(path: string, anchor: string): number {
		return this.files.get(path)?.lines.findIndex((line) => line.anchor === anchor) ?? -1;
	}

	entry(path: string): LedgerEntry | undefined {
		const ledger = this.files.get(path);
		if (!ledger) return undefined;
		return { path, hash: contentHash(ledger.lines.map((l) => l.text)), anchors: ledger.lines.map((l) => l.anchor) };
	}
}
