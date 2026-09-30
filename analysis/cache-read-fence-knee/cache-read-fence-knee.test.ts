import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Replays docs/attachments/cache-read-fence-knee/index.md checks 1–5 and F1–F5.
// Requires the historical local session corpus and board log, like the drive.
const here = import.meta.dir;
let out: string;
let rows: any[], curves: Record<string, any[]>, board: any[], results: string;
function cli(script: string, args: string[] = []) {
	const run = spawnSync("python3", [join(here, script), ...args], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
	expect({ status: run.status, stderr: run.stderr }).toEqual({ status: 0, stderr: "" });
	return run.stdout;
}
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
beforeAll(() => {
	out = mkdtempSync(join(tmpdir(), "cache-knee-drive-"));
	cli("final.py", ["--output-dir", out]);
	cli("board_corr.py", ["--output-dir", out]);
	rows = json(join(out, "sessions.json"));
	curves = json(join(out, "curves.json"));
	board = json(join(out, "board_corr.json"));
	results = readFileSync(join(out, "results.md"), "utf8");
}, 120_000);
afterAll(() => { if (out) rmSync(out, { recursive: true, force: true }); });

// Check 1 / F2: the user's tool axis includes every emitted tool, plus no-tool reads.
test("CLI reproduces the corpus and complete billed-call to tool-index curves", () => {
	expect(rows).toHaveLength(40);
	expect(rows.reduce((n, r) => n + r.R, 0)).toBe(1_198_142_082);
	expect(rows.reduce((n, r) => n + r.cost, 0)).toBeCloseTo(849.21, 2);
	expect(Object.keys(curves).sort()).toEqual(rows.map(r => r.sid).sort());
	for (const r of rows) {
		const points = curves[r.sid];
		expect(points).toHaveLength(r.n);
		let C = 0, tools = 0;
		for (const [i, p] of points.entries()) {
			C += p.cache_read;
			expect(p.assistant_index).toBe(i + 1);
			expect(p.tool_first).toBe(p.tools ? tools + 1 : null);
			tools += p.tools;
			expect(p.tool_index).toBe(tools);
			expect(p.cumulative_cache_read).toBe(C);
		}
		expect(C).toBe(r.R);
		expect(tools).toBe(r.ntools);
	}
	for (const [name, ntools, n, R] of [["transcript-capture-feasibility", 558, 583, 231_720_892], ["hook-emission-snapshots", 406, 424, 159_620_858]] as const) {
		const r = rows.find(r => r.name.endsWith(`__worktrees-${name}`));
		expect([r.ntools, r.n, r.R]).toEqual([ntools, n, R]);
	}
});

// Check 2 / F3: compare what the report says with what the analyst can read.
test("published ranges agree with session results and use one-based call indices", () => {
	const slope = rows.map(r => r.knee_slope2).filter(k => k !== null);
	const cp = rows.map(r => r.knee_cp / r.n);
	expect(results).toContain(`call range: ${Math.min(...slope)}–${Math.max(...slope)} (${slope.length} non-null; ${rows.length - slope.length} null)`);
	expect(results).toContain(`fraction: ${Math.min(...cp).toFixed(3)}–${Math.max(...cp).toFixed(3)}`);
	const report = readFileSync(join(here, "report.md"), "utf8");
	expect(report).toContain("13–58, 38 non-null / 2 null");
	expect(report).toContain("24.7–61.8%");
	expect(report).toContain("only 1/40 at the k=5 search floor");
});

// Check 3 / F4: the exact extreme's timestamp, signed proximity and usage.
test("policy knees link timestamped steers, own/run checkpoints and adjacent cache outcomes", () => {
	const r = rows.find(r => r.name.endsWith("__worktrees-transcript-capture-feasibility"));
	const b = board.find(b => b.sid === r.sid);
	const k = b.knees.context_300k;
	expect(r.kx["300"]).toBe(202);
	expect([k.assistant_index, k.tool_index, k.timestamp]).toEqual([202, 194, "2026-09-14T10:28:11.109Z"]);
	expect(k.nearest_steer.ts).toBe("2026-09-14T10:18:19.846Z");
	expect(k.nearest_steer.gap_seconds).toBeCloseTo(-591.263, 3);
	expect(k.nearest_checkpoint).toEqual({ ts: "2026-09-14T11:20:27.171Z", id: "mu15ix43-kcn7zb", topic: "concept/transcript-capture-feasibility/transcript-capture-feasibility", gap_seconds: 3136.062 });
	expect(k.cache_miss).toBe(false);
	expect(k.adjacent_calls.map((p: any) => p.assistant_index)).toEqual([201, 202, 203]);
	for (const b of board) {
		for (const k of Object.values(b.knees) as any[]) {
			if (!k) continue;
			expect(k.context).toBe(curves[b.sid][k.assistant_index - 1].context);
			for (const key of ["nearest_steer", "nearest_checkpoint", "nearest_run_checkpoint"]) {
				const event = k[key];
				if (event) expect(event.gap_seconds).toBeCloseTo((Date.parse(event.ts) - Date.parse(k.timestamp)) / 1000, 3);
				else expect(event).toBeNull();
			}
		}
	}
	const vertex = board.find(b => b.work === "vertex-176");
	expect(vertex.knees.context_300k.nearest_checkpoint).toBeNull();
});

// Check 4: public deterministic estimator, then independent per-call replay
// using real public curves and the same original follow-ups across the boundary.
test("fresh-prefix replay pays each growing call once, including the sunk prefix", () => {
	const estimate = (v: any) => JSON.parse(cli("final.py", ["--estimate-json", JSON.stringify(v)])).counterfactual;
	expect(estimate({ x: [10000, 20000, 30000], P0: 10000, k: 0 })).toBe(60000);
	expect(estimate({ x: [10000, 20000, 30000], P0: 10000, k: 1, cumulative_reads: [10000, 30000, 60000] })).toBe(40000);
	expect(estimate({ x: [10000, 20000, 30000], P0: 10000, k: 0, steer_at: [3] })).toBe(40000);
	for (const r of rows) {
		const points = curves[r.sid];
		const b = board.find(b => b.sid === r.sid);
		for (const th of ["100", "200", "300"]) {
			const k = r.kx[th];
			if (k === null) {
				expect(r.cfx[th]).toBe(r.R);
				expect(r.save_x[th]).toBe(0);
				continue;
			}
			let expected = points[k - 1].cumulative_cache_read;
			let base = points[k]?.context;
			const resets = new Set(b.steers.map((s: any) => s.assistant_index));
			for (let j = k; j < points.length; j++) {
				if (resets.has(j + 1)) base = points[j].context;
				expected += r.P0 + Math.max(0, points[j].context - base);
			}
			expect(r.cfx[th]).toBe(expected);
			expect(r.cfx[th] + r.save_x[th]).toBe(r.R);
		}
	}
});

// Check 5 / F1 / F5: the report is a usable complete result, and regeneration
// neither changes the published packet nor writes tracked bytecode.
test("all sessions/policies are published worst-first, economic limits explicit, reruns reproducible", () => {
	const report = readFileSync(join(here, "report.md"), "utf8");
	expect(report).toContain("subscription models ride weekly pools");
	expect(report).toContain("PI_CHECKPOINT");
	expect(report).toContain("contextWindow >= 400_000 ? 0.3 : 0.6");
	expect(report).toContain("context fraction**, not cumulative cache reads");
	expect(report).toContain("zero state re-derivation overhead");
	expect(report).toContain("after** them");
	for (let i = 1; i < rows.length; i++) expect(rows[i - 1].R).toBeGreaterThanOrEqual(rows[i].R);
	for (const r of rows) expect(results).toContain(`(${r.sid.slice(0, 8)}) | ${r.R.toLocaleString("en-US")} |`);
	for (const file of ["sessions.json", "curves.json", "board_corr.json", "results.md"]) {
		expect(readFileSync(join(out, file), "utf8")).toBe(readFileSync(join(here, file), "utf8"));
	}
	expect(existsSync(join(here, "__pycache__", "scan.cpython-314.pyc"))).toBe(false);
});
