import { describe, expect, test } from "bun:test";
import { pipe, words } from "./pipe";

describe("words", () => {
	test("splits on whitespace, honors quotes", () => {
		expect(words("a b:1-2  c")).toEqual(["a", "b:1-2", "c"]);
		expect(words(`"my file.md:all" 'x y' z`)).toEqual(["my file.md:all", "x y", "z"]);
		expect(words("")).toEqual([]);
	});
});

describe("pipe", () => {
	test("runs bash with the text on stdin", () => {
		expect(pipe("b\na\n", "sort", "/tmp")).toBe("a\nb\n");
	});
	test("nonzero exit throws", () => {
		expect(() => pipe("", "exit 3", "/tmp")).toThrow(/exited 3/);
	});
});
