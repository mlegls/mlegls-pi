import { expect, test } from "bun:test";
import { conflicts } from "./compaction.ts";

test("same role from different mechanisms conflicts; different roles compose", () => {
	expect(conflicts([
		{ role: "memory", name: "om", owner: "extensions/context" },
		{ role: "board", name: "mail", owner: "extensions/context" },
	])).toEqual([]);
	expect(conflicts([
		{ role: "memory", name: "om", owner: "extensions/context" },
		{ role: "memory", name: "pi-observational-memory", owner: "npm:pi-observational-memory" },
	])).toHaveLength(1);
});
