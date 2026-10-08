import { expect, test } from "bun:test";
import { conflicts, defaults, resolve } from "./mechanism.ts";

test("same surface from different owners conflicts; different surfaces compose", () => {
	expect(conflicts([
		{ role: "compaction", name: "om", owner: "extensions/context" },
		{ role: "board", name: "mail", owner: "extensions/context" },
	])).toEqual([]);
	expect(conflicts([
		{ role: "compaction", name: "om", owner: "extensions/context" },
		{ role: "compaction", name: "pi-observational-memory", owner: "npm:pi-observational-memory" },
	])).toHaveLength(1);
});

const journal = { name: "journal", owns: ["compaction"] };
const om = { name: "om", owns: ["compaction"] };
const optmem = { name: "optmem", owns: ["compaction", "context"] };
const elide = { name: "elide", owns: ["context"] };
const notes = { name: "notes", owns: [] };
const all = [journal, om, optmem, elide, notes];

test("without a list: the chosen system, then everything overlapping none of those", () => {
	expect(defaults(all, undefined).map((s) => s.name)).toEqual(["journal", "elide", "notes"]);
	expect(defaults(all, "optmem").map((s) => s.name)).toEqual(["optmem", "notes"]);
});

test("a list turns on exactly its systems; an overlap is an error and the later one stays off", () => {
	expect(resolve(all, all, ["om", "elide", "notes"])).toEqual({ on: [om, elide, notes], errors: [] });
	const r = resolve(all, all, ["optmem", "elide", "notes"]);
	expect(r.on).toEqual([optmem, notes]);
	expect(r.errors).toEqual(["elide and optmem both own context: elide is off"]);
	expect(resolve([journal], all, ["om", "nope"]).errors).toEqual(["om is disabled in settings", "no memory system named nope"]);
});
