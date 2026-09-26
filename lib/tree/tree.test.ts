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
session("child", [meta({ run: "r", handle: "a", parentSession: "parent", mode: "tui" }), user("do a")]);
session("headless", [meta({ invokedBy: "child", mode: "print" }), user("summarize")]);
session("orphan", [meta({ run: "r", handle: "b", parentSession: "dead" }), user("do b")]);
session("dead", [user("gone parent")]);

describe("graph", () => {
	test("links spawn and invoked parents, and marks live children of ended parents as orphans", async () => {
		writeLive({ pid: process.pid, sessionId: "orphan", cwd, state: "working", since: new Date().toISOString(), mode: "print" });
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
	test("status puts interactive sessions first, keeping state groups distinct", async () => {
		const g = await graph();
		const r = rows(g, "status", { all: true });
		expect(g.get("child")!.interactive).toBe(true); // Spawned does not imply headless.
		expect(g.get("headless")!.interactive).toBe(false);
		expect(g.get("orphan")!.interactive).toBe(false); // Live mode overrides legacy metadata.
		expect(r.filter(x => x.depth === 0).map(x => x.label)).toEqual(["interactive", "non-interactive"]);
		expect(r.findIndex(x => x.node?.id === "child")).toBeLessThan(r.findIndex(x => x.node?.id === "headless"));
		expect(r.filter(x => x.label === "resumable" && x.kind === "header").map(x => x.key))
			.toEqual(["status:interactive:resumable", "status:non-interactive:resumable"]);
		expect(rows(g, "status", { all: true, collapsed: new Set(["status:non-interactive:resumable"]) })
			.some(x => x.node?.id === "headless")).toBe(false);
		const text = r.map(line);
		expect(text.some(x => x === "  resumable (2)")).toBe(true);
	});
	test("project trees prioritize urgent descendants without moving them from their parent", async () => {
		const g = await graph();
		const parent = g.get("parent")!, child = g.get("child")!, headless = g.get("headless")!;
		const orphan = g.get("orphan")!, sibling = g.get("dead")!;
		parent.state = "idle";
		child.state = "working";
		child.report = { tag: "needs-input", ts: new Date().toISOString(), body: "question" };
		orphan.project = "other";
		orphan.state = "working";
		sibling.parent = parent.id;
		sibling.state = "working";
		parent.children.push(sibling.id);
		const r = rows(g, "tree", { all: true });
		const project = r.find(x => x.kind === "header" && x.label === parent.project)!;
		expect(project.urgency).toBe("needs you");
		expect(project.needs).toBe(1);
		expect(r.find(x => x.node === parent)!.needs).toBe(1);
		expect(r.find(x => x.node === parent)!.depth).toBe(1);
		expect(r.find(x => x.node === child)!.depth).toBe(2);
		expect(r.find(x => x.node === headless)!.depth).toBe(3);
		expect(r.findIndex(x => x.node === child)).toBeLessThan(r.findIndex(x => x.node === sibling));
		const folded = rows(g, "tree", { all: true, collapsed: new Set(["tree:session:parent"]) });
		expect(folded.find(x => x.node === parent)!.needs).toBe(1);
		expect(folded.some(x => x.node === child)).toBe(false);
		const filtered = rows(g, "tree", { query: "summ" });
		expect(filtered.filter(x => x.node).map(x => x.node!.id)).toEqual(["parent", "child", "headless"]);
	});

	test("cross-project children are roots in their own project, not under the parent's header", async () => {
		const g = await graph();
		const child = g.get("child")!;
		child.project = "another";
		const r = rows(g, "tree", { all: true });
		expect(r.find(x => x.node === child)!.depth).toBe(1);
		expect(r.findIndex(x => x.kind === "header" && x.label === "another")).toBeLessThan(r.findIndex(x => x.node === child));
		expect(rows(g, "tree", { query: "project:another" }).filter(x => x.node).map(x => x.node!.id)).toEqual(["child"]);
	});
});
