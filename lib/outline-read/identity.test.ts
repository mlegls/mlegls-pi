import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSourceAPI, SourceFile } from "../../extensions/exec/source";
import { Ledger } from "./ledger";
import { scent } from "./anchors";

async function fixture(run: (api: ReturnType<typeof createSourceAPI>, path: string, ledger: Ledger) => Promise<void>) {
	const cwd = await mkdtemp(join(tmpdir(), "anchor-identity-"));
	const ledger = new Ledger();
	const api = createSourceAPI({ cwd, ledger, persist() {} });
	try { await run(api, join(cwd, "f.txt"), ledger); }
	finally { await rm(cwd, { recursive: true, force: true }); }
}

for (const text of ["same", ""]) test("retained survivor after deleting preceding duplicate: " + JSON.stringify(text), () => fixture(async (api, path) => {
	await writeFile(path, ["A", text, text, "B", ""].join("\n"));
	const { rows } = await api.read(path) as SourceFile;
	await api.edit([{ delete: rows[1] }]);
	await api.edit([{ replace: rows[2], text: "MARK" }]);
	expect(await readFile(path, "utf8")).toBe("A\nMARK\nB\n");
}));

test("inserting a duplicate does not redirect the original row", () => fixture(async (api, path) => {
	await writeFile(path, "A\nsame\nB\n");
	const { rows } = await api.read(path) as SourceFile;
	await api.edit([{ before: rows[1], text: "same" }]);
	await api.edit([{ replace: rows[1], text: "MARK" }]);
	expect(await readFile(path, "utf8")).toBe("A\nsame\nMARK\nB\n");
}));

test("unchanged interior of a replacement retains its anchor without borrowing from outside", () => fixture(async (api, path) => {
	await writeFile(path, "A\nsame\nold\nsame\nB\n");
	const { rows } = await api.read(path) as SourceFile;
	await api.edit([{ replace: [rows[2], rows[4]], text: "new\nsame\nB" }]);
	await api.edit([{ replace: rows[3], text: "MARK" }]);
	expect(await readFile(path, "utf8")).toBe("A\nsame\nnew\nMARK\nB\n");
}));

for (const resume of [false, true]) test("deleted names cannot revive" + (resume ? " after resume" : ""), () => fixture(async (api, path, ledger) => {
	await writeFile(path, "A\ntarget\nB\nC\n");
	const { rows } = await api.read(path) as SourceFile;
	await api.edit([{ delete: rows[1] }]);
	if (resume) {
		const restored = new Ledger();
		restored.restore(JSON.parse(JSON.stringify(ledger.entry(path))));
		api = createSourceAPI({ cwd: join(path, ".."), ledger: restored, persist() {} });
		await api.read(path);
	}
	await api.edit([{ after: rows[3], text: "target" }]);
	await expect(api.edit([{ replace: rows[1], text: "WRONG" }])).rejects.toThrow(/unknown anchors/);
	expect(await readFile(path, "utf8")).toBe("A\nB\nC\ntarget\n");
}));

test("unread restored files reserve their names even when their content changed", () => fixture(async (api, path, ledger) => {
	await writeFile(path, "target\n");
	const { rows } = await api.read(path) as SourceFile;
	const restored = new Ledger();
	restored.restore(ledger.entry(path)!);
	// Force the same preferred namespace to exercise reservation before lazy sync.
	let suffix = 0;
	while (scent(path + "." + suffix) !== scent(path)) suffix++;
	const other = path + "." + suffix;
	const replacement = restored.sync(other, ["target"]).ledger.lines[0];
	expect(replacement.anchor).not.toBe(rows[0].anchor);
	restored.sync(path, ["changed"]);
	expect(restored.find(rows[0].anchor)).toBeUndefined();
	const resumed = new Ledger();
	resumed.restore(restored.entry(path)!);
	expect(resumed.sync(path, ["target"]).ledger.lines[0].anchor).not.toBe(rows[0].anchor);
}));
