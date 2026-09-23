import { expect, test } from "bun:test";
import { Kernel, type KernelLate } from "./kernel";

async function until(predicate: () => boolean) {
	const deadline = Date.now() + 3000;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error("Expected host event within 3s");
		await Bun.sleep(10);
	}
}

test("structured host results can be filtered before display; late shows arrive by handle and a restart aborts host work", async () => {
	const notices: KernelLate[] = [];
	let release: (value: unknown) => void = () => { throw new Error("job not started"); };
	let started = false, aborted = false;
	const kernel = new Kernel({
		cwd: process.cwd(), ledger: [], persist() {}, onLate: n => notices.push(n),
		call: async ({ method, signal }) => {
			if (method === "search") return { results: [{ title: "discard", text: "x".repeat(100_000) }, { title: "keep", text: "needle" }], costDollars: { total: 0.007 } };
			if (method === "list") { started = true; return new Promise(resolve => { release = resolve; }); }
			if (method === "wait") return new Promise((_, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled")); }, { once: true }));
			throw new Error("host unavailable");
		},
	});
	try {
		const fetched = await kernel.execute('state.response = await exa.search("query");');
		expect(fetched.error).toBeUndefined();
		expect(fetched.output).toBe("");
		const filtered = await kernel.execute('show(state.response.results.filter(r => r.title === "keep")); show(state.response.costDollars.total);');
		expect(filtered.output).toContain("needle");
		expect(filtered.output).toContain("0.007");
		expect(filtered.output).not.toContain("discard");
		expect((await kernel.execute('state.job = term.list(); show(state.job.then(list => list[0].status));', { id: 4, yieldMs: 50 })).running).toBe(true);
		await until(() => started);
		release([{ handle: "worker", status: "done" }]);
		await until(() => notices.some(n => n.handle === "c4.1"));
		expect(notices.find(n => n.handle === "c4.1")!.content).toEqual([{ type: "text", text: "done\n" }]);
		expect((await kernel.execute('show((await state.job)[0].handle);')).output).toContain("worker");
		const controller = new AbortController();
		const waiting = kernel.execute('await term.wait({ waitMs: 60000 });', { signal: controller.signal });
		const timer = setTimeout(() => controller.abort(), 150);
		try { expect((await waiting).running).toBe(true); } finally { clearTimeout(timer); }
		expect(aborted).toBe(false);
		await kernel.restart();
		await until(() => aborted);
		expect((await kernel.execute('show(typeof state.response);')).output).toBe("undefined\n");
		const failed = await kernel.execute('show("before"); await ui.help();');
		expect(failed.output).toBe("before\n");
		expect(failed.error).toContain("host unavailable");
	} finally { await kernel.dispose(); }
}, 15000);
