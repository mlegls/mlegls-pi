import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolated agent dir, cache and live dir; never the real sessions.
const root = mkdtempSync(join(tmpdir(), "ab-tree-"));
process.env.PI_CODING_AGENT_DIR = join(root, "agent");
process.env.XDG_CACHE_HOME = join(root, "cache");
process.env.XDG_STATE_HOME = join(root, "state");
process.env.PI_BOARD_DIR = join(root, "board");
const { graph } = await import("./graph");
const { rows, line } = await import("./view");
const { writeLive } = await import("../session-meta/live");

const dir = join(root, "agent/sessions/--proj--");
mkdirSync(dir, { recursive: true });
const cwd = mkdtempSync(join(tmpdir(), "ab-tree-cwd-"));
let n = 0;
function session(id: string, extra: object[] = [], at = new Date().toISOString()) {
	const lines = [{ type: "session", version: 3, id, timestamp: at, cwd }, ...extra];
	writeFileSync(join(dir, `${String(n++).padStart(4, "0")}_${id}.jsonl`), lines.map(l => JSON.stringify(l)).join("\n") + "\n");
}
const meta = (data: object) => ({ type: "custom", customType: "session-meta", data });
const user = (text: string) => ({ type: "message", message: { role: "user", content: text } });

session("parent", [user("plan the thing")]);
session("child", [meta({ run: "r", handle: "a", parentSession: "parent" }), user("do a")]);
session("headless", [meta({ invokedBy: "child" }), user("summarize")]);
session("orphan", [meta({ run: "r", handle: "b", parentSession: "dead" }), user("do b")]);
session("dead", [user("gone parent")]);

describe("graph", () => {
	test("links spawn and invoked parents, and marks live children of ended parents as orphans", async () => {
		writeLive({ pid: process.pid, sessionId: "orphan", cwd, state: "working", since: new Date().toISOString() });
		writeLive({ pid: process.ppid, sessionId: "parent", cwd, state: "idle", since: new Date().toISOString() });
		const g = await graph();
		expect(g.get("child")!.parent).toBe("parent");
		expect(g.get("headless")!.parentKind).toBe("invoked");
		expect(g.get("parent")!.children).toEqual(["child"]);
		expect(g.get("orphan")!.state).toBe("working");
		expect(g.get("orphan")!.orphan).toBe(true);
		expect(g.get("child")!.orphan).toBeUndefined();
		expect(g.get("child")!.title).toBe("r/a");
	});

	test("tree rows nest children and a query keeps ancestors", async () => {
		const g = await graph();
		const text = rows(g, "tree", { all: true }).map(line);
		expect(text.some(l => l.startsWith("    ") && l.includes("summarize"))).toBe(true);
		const hit = rows(g, "tree", { query: "summ" });
		expect(hit.filter(r => r.kind === "node").map(r => r.node!.id)).toEqual(["parent", "child", "headless"]);
		expect(hit.find(r => r.node?.id === "parent")!.match).toBe(false);
		expect(rows(g, "status", { query: "state:orphan" }).filter(r => r.node).map(r => r.node!.id)).toEqual(["orphan"]);
	});
});
