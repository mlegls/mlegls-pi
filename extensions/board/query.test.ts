import { describe, expect, test } from "bun:test";
import { compileQuery, evalTags, matchTopic, parseTags } from "./query";

describe("matchTopic", () => {
	test("exact and single-segment glob", () => {
		expect(matchTopic("a/b", "a/b")).toBe(true);
		expect(matchTopic("a/*", "a/b")).toBe(true);
		expect(matchTopic("a/*", "a/b/c")).toBe(false);
		expect(matchTopic("*/b", "a/b")).toBe(true);
	});
	test("globstar", () => {
		expect(matchTopic("**", "anything/at/all")).toBe(true);
		expect(matchTopic(undefined, "x")).toBe(true);
		expect(matchTopic("a/**", "a")).toBe(true);
		expect(matchTopic("a/**", "a/b/c")).toBe(true);
		expect(matchTopic("a/**/z", "a/z")).toBe(true);
		expect(matchTopic("a/**/z", "a/b/c/z")).toBe(true);
		expect(matchTopic("a/**/z", "a/b/c")).toBe(false);
	});
});

describe("parseTags / evalTags", () => {
	const has = (q: string, tags: string[]) => evalTags(parseTags(q), tags);
	test("empty matches all", () => {
		expect(has("", [])).toBe(true);
		expect(has(undefined as unknown as string, ["x"])).toBe(true);
	});
	test("single tag", () => {
		expect(has("done", ["done"])).toBe(true);
		expect(has("done", ["blocked"])).toBe(false);
	});
	test("precedence: ! > & > |", () => {
		expect(has("a | b & c", ["a"])).toBe(true);
		expect(has("a | b & c", ["b"])).toBe(false);
		expect(has("a | b & c", ["b", "c"])).toBe(true);
		expect(has("!a & b", ["b"])).toBe(true);
		expect(has("!a & b", ["a", "b"])).toBe(false);
		expect(has("!(a & b)", ["a"])).toBe(true);
	});
	test("comma is and; namespaced tags", () => {
		expect(has("kind:decision, path:src/x.ts", ["kind:decision", "path:src/x.ts"])).toBe(true);
		expect(has("kind:decision, path:src/x.ts", ["kind:decision"])).toBe(false);
	});
	test("errors", () => {
		expect(() => parseTags("a &")).toThrow();
		expect(() => parseTags("(a")).toThrow();
		expect(() => parseTags("a b")).toThrow();
		expect(() => parseTags("a $ b")).toThrow();
	});
});

test("compileQuery combines topic and tags", () => {
	const q = compileQuery({ topic: "compile/*", tags: "done | blocked" });
	expect(q("compile/u1", ["done"])).toBe(true);
	expect(q("compile/u1", ["progress"])).toBe(false);
	expect(q("review/u1", ["done"])).toBe(false);
});
