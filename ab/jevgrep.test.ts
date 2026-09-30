import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSourceAPI } from "../extensions/exec/source";
import { Ledger } from "../lib/outline-read/ledger";
import { deadline, renderRetrieval, retrievalArgs, DEFAULT_DEADLINE_SECONDS, DEFAULT_SOURCE_BYTES, type Retrieval } from "./jevgrep";

test("retrieval anchors share the ledger, survive restore, and edit exact Unicode evidence", async () => {
	const root = await mkdtemp(join(tmpdir(), "ab-jg-"));
	try {
		const path = join(root, "a.ts");
		await writeFile(path, "first\n疒奀\nlast\n");
		const ledger = new Ledger();
		const api = createSourceAPI({ cwd: root, ledger, persist() {} });
		const result: Retrieval = { schemaVersion: 1, root, introduction: "ranked files", closing: "End context.", files: [{ path: "a.ts", excerpts: [{ range: { startLine: 2, endLine: 2 }, source: "疒奀" }] }] };
		const text = await renderRetrieval(result, api);
		const anchor = ledger.get(path)!.lines[1].anchor;
		expect(text).toContain(`2 ${anchor}│疒奀`);
		const eof = structuredClone(result);
		eof.files[0].excerpts = [{ range: { startLine: 3, endLine: 4 }, source: "last\n" }];
		expect(await renderRetrieval(eof, api)).toContain(`3 ${ledger.get(path)!.lines[2].anchor}│last`);
		expect(await renderRetrieval(eof, api)).not.toContain("stale excerpt");
		const restored = new Ledger();
		restored.restore(ledger.entry(path)!);
		const next = createSourceAPI({ cwd: root, ledger: restored, persist() {} });
		expect(await renderRetrieval(result, next)).toBe(text);
		await next.edit(`=${anchor}\nchanged`);
		expect(await readFile(path, "utf8")).toBe("first\nchanged\nlast\n");
		const stale = await renderRetrieval(result, next);
		expect(stale).toContain("stale excerpt");
		expect(stale).not.toContain("│");
		result.files[0].excerpts[0].partial = true;
		expect(await renderRetrieval(result, next)).toContain("partial excerpt; no edit anchors");
		await rm(path);
		expect(await renderRetrieval(result, next)).toContain("unavailable:");
	} finally { await rm(root, { recursive: true, force: true }); }
});

test("patched JSON renderer retains ordering, source budget, and metadata without prose parsing", async () => {
	const bundle = await readFile(join(import.meta.dir, "../node_modules/@dzhng/jevgrep/dist/bin/index.js"), "utf8");
	const start = bundle.indexOf("function renderResult(");
	const end = bundle.indexOf("\n}", start) + 2;
	const render = new Function("quote", "DEFAULT_MAX_SOURCE_BYTES", `${bundle.slice(start, end)}; return renderResult;`)(JSON.stringify, 0);
	const file = (path: string, score: number) => ({ path, score, roles: ["test"], leads: [], excerpts: [{ range: { startLine: 1, endLine: 1 }, source: "hello" }] });
	const result = { files: [file("low", 1), file("high", 2)], status: "incomplete", issues: [], repositoryContext: { instructionFiles: [], pytestFiles: [] } };
	const json = JSON.parse(render(result, 5, "/repo"));
	expect(json.schemaVersion).toBe(1);
	expect(json.root).toBe("/repo");
	expect(json.files.map((f: any) => f.path)).toEqual(["high", "low"]);
	expect(json.files[0].excerpts[0].source).toBe("hello");
	expect(json.files[1].excerpts).toEqual([]);
	expect(json.files[1].omitted).toBe(true);
	expect(json.introduction).toContain('"low"');
	expect(json.closing).toContain('"low"');
	expect(json.introduction).toContain("discovery incomplete");
	expect(json.closing).toContain("End context.");
	expect(render(result)).toContain("```\nhello\n```");
});

test("wrapper bounds source by default and preserves explicit budgets", () => {
	expect(retrievalArgs(["question", "."])).toEqual(["--json", "--max-source-bytes", String(DEFAULT_SOURCE_BYTES), "question", "."]);
	for (const option of [["--max-source-bytes", "0"], ["--max-source-bytes=1024"]]) {
		const args = ["question", ".", ...option];
		expect(retrievalArgs(args)).toEqual(["--json", ...args]);
	}
	expect(retrievalArgs(["question", "--", "--max-source-bytes=0"])).toEqual(["--json", "--max-source-bytes", String(DEFAULT_SOURCE_BYTES), "question", "--", "--max-source-bytes=0"]);
});

test("deadline option parser rejects empty limits rather than silently disabling the bound", () => {
	for (const args of [["q", "--deadline="], ["q", "--deadline", ""], ["q", "--deadline", " "]]) {
		expect(() => deadline(args)).toThrow("usage: --deadline SECONDS");
	}
	expect(deadline(["q", "."])).toEqual([DEFAULT_DEADLINE_SECONDS, ["q", "."]]);
	expect(deadline(["q", "--deadline", "0"])).toEqual([0, ["q"]]);
});
