import { describe, expect, test } from "bun:test";
import { words } from "./words";

describe("words", () => {
	test("splits on whitespace, honors quotes", () => {
		expect(words("a b:1-2  c")).toEqual(["a", "b:1-2", "c"]);
		expect(words(`"my file.md:all" 'x y' z`)).toEqual(["my file.md:all", "x y", "z"]);
		expect(words("")).toEqual([]);
	});
});
