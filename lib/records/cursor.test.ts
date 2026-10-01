import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCursor, writeCursor } from "./cursor.ts";

const dir = mkdtempSync(join(tmpdir(), "records-cursor-"));
const saved = process.env.PI_BOARD_DIR;
beforeAll(() => { process.env.PI_BOARD_DIR = dir; });
afterAll(() => { process.env.PI_BOARD_DIR = saved; rmSync(dir, { recursive: true, force: true }); });

// A session tree: a1 → a2 → a3 on one branch, a1 → b2 on another.
function session(id: string, parentSession?: string) {
	const s = { branch: [] as { id: string }[], getSessionId: () => id, getLeafId: () => s.branch.at(-1)?.id ?? null, getBranch: () => s.branch, getHeader: () => ({ parentSession }) };
	return s;
}
const at = (...ids: string[]) => ids.map((id) => ({ id }));

test("the latest cursor visible from the branch wins; other branches' and other keys' don't leak", () => {
	const s = session("c-s1");
	expect(readCursor(s, "k")).toBeUndefined();
	s.branch = at("a1"); writeCursor(s, "k", 1);
	s.branch = at("a1", "a2"); writeCursor(s, "k", 2);
	s.branch = at("a1", "a2", "a3"); writeCursor(s, "k", 3); writeCursor(s, "other", 99);
	s.branch = at("a1", "b2"); writeCursor(s, "k", 20);
	expect(readCursor(s, "k")).toBe(20);
	s.branch = at("a1", "a2", "a3");
	expect(readCursor(s, "k")).toBe(3);
	s.branch = at("a1", "a2");
	expect(readCursor(s, "k")).toBe(2);
	s.branch = at("a1");
	expect(readCursor(s, "k")).toBe(1);
});

test("a fork resumes its parent's cursor as of the fork point", () => {
	const parent = session("c-p");
	parent.branch = at("p1"); writeCursor(parent, "k", "at-p1");
	parent.branch = at("p1", "p2"); writeCursor(parent, "k", "at-p2");
	const file = join(dir, "parent.jsonl");
	writeFileSync(file, JSON.stringify({ type: "session", id: "c-p" }) + "\n");
	const fork = session("c-f", file);
	fork.branch = at("p1");
	expect(readCursor(fork, "k")).toBe("at-p1");
	fork.branch = at("p1", "f2"); writeCursor(fork, "k", "at-f2");
	expect(readCursor(fork, "k")).toBe("at-f2");
	expect(readCursor(parent, "k")).toBe("at-p2");
});
