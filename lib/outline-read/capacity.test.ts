import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Kernel } from "../../extensions/exec/kernel";
import { ALPHABET, ANCHOR_CAPACITY, AnchorSet, allocateAnchor, isAnchor, PREFIX_CAPACITY, scent } from "./anchors";
import { Ledger, type LedgerEntry } from "./ledger";

test("public Kernel: 50k identical rows spill, restore, and reject stale edits within 10s", async () => {
	const cwd = await mkdtemp(join(tmpdir(), "anchor-capacity-"));
	const path = join(cwd, "repeat.txt");
	const text = "identical line here\n".repeat(50_000);
	let entry: LedgerEntry | undefined;
	let kernel = new Kernel({ cwd, ledger: [], persist: value => { entry = value; } });
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 10_000);
	try {
		await writeFile(path, text);
		const started = performance.now();
		const result = await kernel.execute('state.source = await read("repeat.txt"); show(state.source.rows.length);', controller.signal);
		const elapsed = performance.now() - started;
		clearTimeout(timer);
		console.log("50k public Kernel read: " + elapsed.toFixed(1) + "ms");
		expect(result.error).toBeUndefined();
		expect(result.output).toBe("50000\n");
		expect(elapsed).toBeLessThan(10_000);
		const anchors = entry!.anchors;
		expect(anchors).toHaveLength(50_000);
		expect(new Set(anchors).size).toBe(50_000);
		expect(anchors.every(isAnchor)).toBe(true);
		expect(anchors.filter(a => a[0] === scent(path))).toHaveLength(PREFIX_CAPACITY);
		await kernel.dispose();
		kernel = new Kernel({ cwd, ledger: [entry!], persist() {} });
		const restored = await kernel.execute('state.source = await read("repeat.txt");');
		// Compare inside the kernel to avoid renderer output limits.
		expect(restored.error).toBeUndefined();
		const same = await kernel.execute('show(state.source.rows.map(row => row.anchor).join(",") === ' + JSON.stringify(anchors.join(",")) + ');');
		expect(same.output).toBe("true\n");
		const external = "changed externally\n";
		await writeFile(path, external);
		const stale = await kernel.execute('await show(await replace(state.source.lines(1, 1), () => "must not overwrite"));');
		expect(stale.error ?? stale.output).toMatch(/stale|changed|read.*again/i);
		expect(await readFile(path, "utf8")).toBe(external);
	} finally {
		clearTimeout(timer);
		await kernel.dispose();
		await rm(cwd, { recursive: true, force: true });
	}
}, 20_000);

test("global exhaustion is finite, and freeing/resetting updates scan hints", () => {
	const taken = new AnchorSet();
	for (const a of ALPHABET) for (const b of ALPHABET) for (const c of ALPHABET) for (const d of ALPHABET) taken.add(a + b + c + d);
	expect(taken.size).toBe(ANCHOR_CAPACITY);
	expect(() => allocateAnchor("same", taken, "/full")).toThrow(/Anchor capacity exhausted/);
	// Also exercise the public plain-Set fallback, which has no occupancy hints.
	expect(() => allocateAnchor("same", new Set(taken), "/full")).toThrow(/Anchor capacity exhausted/);
	taken.delete("9999");
	expect(allocateAnchor("same", taken, "/full")).toBe("9999");
	taken.clear();
	expect(taken.occupancy.every(count => count === 0)).toBe(true);
	expect(taken.cursor.every(index => index === 0)).toBe(true);
	expect(isAnchor(allocateAnchor("same", taken, "/full"))).toBe(true);
});

test("restored occupancy spills and retired anchors remain reserved", () => {
	const path = "/restored";
	const lines = Array(PREFIX_CAPACITY).fill("same");
	const original = new Ledger();
	original.sync(path, lines);
	const entry = original.entry(path)!;
	const ledger = new Ledger();
	ledger.restore(entry);
	expect(ledger.sync(path, lines).changed).toBe(false);
	const expanded = ledger.sync(path, [...lines, "same"]).ledger.lines;
	expect(expanded.at(-1)!.anchor[0]).not.toBe(scent(path));
	expect(expanded.slice(0, -1).map(line => line.anchor)).toEqual(entry.anchors);
	ledger.sync(path, []);
	expect(ledger.sync(path, ["same"]).ledger.lines[0].anchor[0]).not.toBe(scent(path));
	ledger.reset();
	expect(ledger.sync(path, ["same"]).ledger.lines[0].anchor).toBe(entry.anchors[0]);
});

test("over-capacity sync rejects before taking names or changing existing anchors", () => {
	const ledger = new Ledger();
	const first = ledger.sync("/kept", ["kept"]).ledger.lines[0].anchor;
	expect(() => ledger.sync("/too-big", Array(ANCHOR_CAPACITY).fill("same"))).toThrow(/Anchor capacity exhausted/);
	expect(ledger.get("/too-big")).toBeUndefined();
	expect(ledger.find(first)).toEqual({ path: "/kept", index: 0 });
	expect(ledger.sync("/after", ["same"]).ledger.lines).toHaveLength(1);
});
