import { expect, test } from "bun:test";
import { filterReads } from "./ingress-policy";

test("read filtering follows model families, not versions or providers", () => {
	for (const id of ["gpt-6-sol", "gpt-7-astra", "claude-opus-5-5", "FABLE-next", "claude-sonnet-5"])
		expect(filterReads({ id })).toBe(true);
	for (const id of ["gpt-6-luna", "glm-5.3-flash", "unknown", ""])
		expect(filterReads({ id })).toBe(false);
	expect(filterReads(undefined)).toBe(false);
});
