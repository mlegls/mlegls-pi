/**
 * Line anchors: opaque 4-character names allocated per file and kept for
 * as long as the line survives unchanged. The first character is the file's
 * (a hash of its path), so a file's anchors visibly share a scent and an
 * anchor from the wrong file stands out; the rest is a content hash, so the
 * same file tends to get the same names in every session. Collisions bump to
 * the next free name.
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

/** The character every anchor of `path` starts with. */
export function scent(path: string): string {
	return ALPHABET[createHash("sha1").update(path).digest()[0]! & 31];
}

/** Allocate a name for `text` not present in `taken`, and take it. With `path`, the name carries the file's scent. */
export function allocateAnchor(text: string, taken: Set<string>, path?: string): string {
	const head = path === undefined ? "" : scent(path);
	for (let attempt = 0; ; attempt++) {
		const digest = createHash("sha1").update(text).update(`\0${attempt}`).digest();
		for (let offset = 0; offset + 4 <= digest.length; offset += 4) {
			const candidate = head + encode(digest, offset).slice(head.length);
			if (!taken.has(candidate)) {
				taken.add(candidate);
				return candidate;
			}
		}
	}
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
