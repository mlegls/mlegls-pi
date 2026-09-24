import { expect, test } from "bun:test";
import { CLOSE, OPEN, segments } from "./raw";

test("marks split output into exact and filterable segments and disappear", () => {
	expect(segments("a\n" + OPEN + "b\n" + CLOSE + "c\n")).toEqual([{ text: "a\n", raw: false }, { text: "b\n", raw: true }, { text: "c\n", raw: false }]);
});

test("a cut-off open stays exact to the end; a stray close is dropped; nesting flattens", () => {
	expect(segments("a\n" + OPEN + "b\n")).toEqual([{ text: "a\n", raw: false }, { text: "b\n", raw: true }]);
	expect(segments("a\n" + CLOSE + "b\n")).toEqual([{ text: "a\nb\n", raw: false }]);
	expect(segments(OPEN + "a\n" + OPEN + "b\n" + CLOSE + "c\n" + CLOSE)).toEqual([{ text: "a\nb\nc\n", raw: true }]);
});

test("unmarked output is one filterable segment", () => {
	expect(segments("x\ny")).toEqual([{ text: "x\ny", raw: false }]);
});
