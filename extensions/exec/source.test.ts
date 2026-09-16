import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger } from "../outline-read/ledger";
import { createSourceAPI, SourceFile } from "./source";

async function withApi(run: (api: ReturnType<typeof createSourceAPI>, cwd: string) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "exec-source-"));
	const api = createSourceAPI({ cwd, ledger: new Ledger(), persist() {} });
	try { await run(api, cwd); }
	finally { await rm(cwd, { recursive: true, force: true }); }
}

describe("source grep/read ergonomics", () => {
	test("options as the second argument search instead of throwing", async () => {
		await withApi(async (api, cwd) => {
			await writeFile(join(cwd, "a.ts"), "const n = 1;\n");
			await writeFile(join(cwd, "b.md"), "const n = 2;\n");
			const hits = await api.grep("const n", { glob: "*.ts" });
			expect(hits.map(row => row.path.split("/").pop())).toEqual(["a.ts"]);
		});
	});

	test("a read() result is a grep path", async () => {
		await withApi(async (api, cwd) => {
			await writeFile(join(cwd, "a.ts"), "const n = 1;\n");
			await writeFile(join(cwd, "b.ts"), "const n = 2;\n");
			const a = await api.read("a.ts") as SourceFile;
			const hits = await api.grep("const n", a);
			expect(hits.rows.map(row => row.path.split("/").pop())).toEqual(["a.ts"]);
			const again = await api.grep("const n", a.lines(1, 1));
			expect(again.rows).toHaveLength(1);
		});
	});

	test("file contents passed as a path do not appear in the error", async () => {
		await withApi(async api => {
			const body = "x".repeat(80_000);
			let message = "";
			try { await api.grep("const", body); }
			catch (err) { message = err instanceof Error ? err.message : String(err); }
			expect(message).toMatch(/ENAMETOOLONG/);
			expect(message.length).toBeLessThan(300);
			expect(message).not.toContain(body.slice(0, 1000));
		});
	});

	test("reading a directory names it as a directory", async () => {
		await withApi(async (api, cwd) => {
			await mkdir(join(cwd, "sub"));
			let message = "";
			try { await api.read("sub"); }
			catch (err) { message = err instanceof Error ? err.message : String(err); }
			expect(message).toMatch(/directory/);
			expect(message).not.toMatch(/ENOENT|EISDIR/);
		});
	});

	test("lines().map and join yield the selected text", async () => {
		await withApi(async (api, cwd) => {
			await writeFile(join(cwd, "a.ts"), "one\ntwo\nthree\n");
			const src = await api.read("a.ts") as SourceFile;
			expect(src.lines(1, 2).map(row => row.text)).toEqual(["one", "two"]);
			expect(src.lines(2, 3).join("\n")).toBe("two\nthree");
		});
	});

	test("large file text and rows stay complete", async () => {
		await withApi(async (api, cwd) => {
			const long = "y".repeat(60_000) + "\nend\n";
			await writeFile(join(cwd, "big.ts"), long);
			const src = await api.read("big.ts") as SourceFile;
			expect(src.text.length).toBe(long.length);
			expect(src.text.endsWith("end\n")).toBe(true);
			expect(src.rows.length).toBe(2);
			const many = Array.from({ length: 400 }, (_, i) => "line " + i).join("\n") + "\n";
			await writeFile(join(cwd, "many.ts"), many);
			const lined = await api.read("many.ts") as SourceFile;
			expect(lined.text.length).toBe(many.length);
			expect(lined.rows.length).toBe(400);
			expect(lined.rows[399]?.text).toBe("line 399");
		});
	});
});
