/**
 * Line anchors: opaque 4-character names allocated per file and kept for
 * as long as the line survives unchanged. The first character is the file's
 * preferred scent (a hash of its path), so a file's anchors usually share an
 * initial character; full scents spill into the rest of the namespace. A
 * content hash gives repeatable names in fresh sessions. Collisions scan for
 * the next free name, with bounded work even at global exhaustion.
 */
import { createHash } from "node:crypto";

/** 32 symbols; no 0/o/1/l. */
export const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const ANCHOR_LENGTH = 4;
export const ANCHOR_RE = new RegExp(`^[${ALPHABET}]{${ANCHOR_LENGTH}}$`);
export const SEPARATOR = "│";

/** Matches a pasted `abcd│` (or `+abcd│`, ` abcd│`) prefix on a line. */
const PASTED_PREFIX = new RegExp(`^[+\\- ]?[${ALPHABET}]{${ANCHOR_LENGTH}}${SEPARATOR}`);

function encode(bytes: Buffer, offset: number): string {
	let value = bytes.readUInt32BE(offset);
	let out = "";
	for (let i = 0; i < ANCHOR_LENGTH; i++) {
		out = ALPHABET[value & 31] + out;
		value >>>= 5;
	}
	return out;
}

/** The preferred initial character for anchors of `path`. */
export function scent(path: string): string {
	return ALPHABET[createHash("sha1").update(path).digest()[0]! & 31];
}

export const PREFIX_CAPACITY = 32 ** 3;
export const ANCHOR_CAPACITY = 32 ** ANCHOR_LENGTH;
const capacityError = () => new Error("Anchor capacity exhausted (" + ANCHOR_CAPACITY + " four-character names)");

function suffix(value: number): string {
	return ALPHABET[(value >>> 10) & 31] + ALPHABET[(value >>> 5) & 31] + ALPHABET[value & 31];
}

/** Ledger-owned occupancy and scan hints; all mutations keep them in sync. */
export class AnchorSet extends Set<string> {
	readonly occupancy = new Uint32Array(32);
	readonly cursor = new Uint32Array(32);

	constructor(values?: Iterable<string>) {
		super();
		if (values) for (const value of values) this.add(value);
	}

	override add(anchor: string): this {
		if (!isAnchor(anchor)) throw new Error("Invalid anchor: " + anchor);
		if (!this.has(anchor)) {
			super.add(anchor);
			this.occupancy[ALPHABET.indexOf(anchor[0])]++;
		}
		return this;
	}

	override delete(anchor: string): boolean {
		if (!super.delete(anchor)) return false;
		this.occupancy[ALPHABET.indexOf(anchor[0])]--;
		return true;
	}

	override clear(): void {
		super.clear();
		this.occupancy.fill(0);
		this.cursor.fill(0);
	}
}

/** Allocate and take a name. Hash probes and the fallback scan are both bounded. */
export function allocateAnchor(text: string, taken: Set<string>, path?: string): string {
	if (taken instanceof AnchorSet && taken.size === ANCHOR_CAPACITY) throw capacityError();
	const digest = createHash("sha1").update(text).update("\x000").digest();
	const head = path === undefined ? "" : scent(path);
	// Preserve the usual content-derived names, but never retry hashes indefinitely.
	for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
		const candidate = head + encode(digest, offset).slice(head.length);
		if (!taken.has(candidate)) {
			taken.add(candidate);
			return candidate;
		}
	}
	const preferred = ALPHABET.indexOf(head || encode(digest, 0)[0]);
	for (let step = 0; step < 32; step++) {
		const prefix = (preferred + step) % 32;
		if (taken instanceof AnchorSet && taken.occupancy[prefix] === PREFIX_CAPACITY) continue;
		const start = taken instanceof AnchorSet ? taken.cursor[prefix] : 0;
		for (let scan = 0; scan < PREFIX_CAPACITY; scan++) {
			const index = (start + scan) % PREFIX_CAPACITY;
			const candidate = ALPHABET[prefix] + suffix(index);
			if (!taken.has(candidate)) {
				taken.add(candidate);
				if (taken instanceof AnchorSet) taken.cursor[prefix] = (index + 1) % PREFIX_CAPACITY;
				return candidate;
			}
		}
	}
	throw capacityError();
}

export function isAnchor(value: string): boolean {
	return ANCHOR_RE.test(value);
}

export function formatRow(anchor: string, text: string): string {
	return `${anchor}${SEPARATOR}${text}`;
}

/** Remove a pasted row prefix; returns the line unchanged if none. */
export function stripPastedPrefix(line: string): string {
	return line.replace(PASTED_PREFIX, "");
}
