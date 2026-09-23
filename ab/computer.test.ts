import { expect, test } from "bun:test";
import { placeholders, quoted } from "./computer.ts";

test("quoted spans become inputs named by their text; apostrophes inside words are not quotes", () => {
	expect(quoted("don't touch it, replace the title with 'Q3 plan' and the body with \"it's done\"")).toEqual({ "Q3 plan": "Q3 plan", "it's done": "it's done" });
	expect(quoted("type “smart” and `code`")).toEqual({ smart: "smart", code: "code" });
	expect(quoted("no literals here")).toEqual({});
});

test("placeholders name hidden inputs once each", () => {
	expect(placeholders("log in as %user% with %pass%, then greet %user%")).toEqual(["user", "pass"]);
});
