import { expect, test } from "bun:test";
import { DEFAULTS, resolveCompactAfterTokens } from "../config.js";
import { parseCompactAt } from "./compact-at.js";

test("parseCompactAt reads tokens, fractions, percentages and a reset", () => {
	expect(parseCompactAt("150k")).toEqual({ tokens: 150_000 });
	expect(parseCompactAt("150000")).toEqual({ tokens: 150_000 });
	expect(parseCompactAt("0.2")).toEqual({ ratio: 0.2 });
	expect(parseCompactAt("20%")).toEqual({ ratio: 0.2 });
	expect(parseCompactAt("default")).toBeNull();
	for (const bad of ["", "abc", "1.5", "200%", "12"]) expect(parseCompactAt(bad)).toBeUndefined();
});

test("a session's threshold overrides settings, and a ratio needs a known window", () => {
	const ratioConfig = { ...DEFAULTS, compactAfterTokensMode: "ratio" as const, compactAfterTokensRatio: 0.5 };
	expect(resolveCompactAfterTokens(ratioConfig, 1_000_000)).toBe(500_000);
	expect(resolveCompactAfterTokens(ratioConfig, 1_000_000, { tokens: 150_000 })).toBe(150_000);
	expect(resolveCompactAfterTokens(ratioConfig, 1_000_000, { ratio: 0.2 })).toBe(200_000);
	expect(resolveCompactAfterTokens(DEFAULTS, undefined, { ratio: 0.2 })).toBe(DEFAULTS.compactAfterTokens);
});
