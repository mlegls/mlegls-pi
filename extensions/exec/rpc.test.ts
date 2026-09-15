import { expect, test } from "bun:test";
import { Kernel, type KernelNotification } from "./kernel";

async function until(predicate: () => boolean) {
	const deadline = Date.now() + 3000;
	while (!predicate()) {
		if (Date.now() > deadline) throw new Error("Expected host event within 3s");
		await Bun.sleep(10);
	}
}

test("structured host results can be filtered before display; saved jobs notify and interruption aborts host work", async () => {
	const notices: KernelNotification[] = [];
	let release: (value: unknown) => void = () => { throw new Error("job not started"); };
	let started = false, aborted = false;
	const kernel = new Kernel({
		cwd: process.cwd(), ledger: [], persist() {}, onNotification: n => notices.push(n),
		call: async ({ method, signal }: any) => {
			if (method === "search") return { results: [{ title: "discard", text: "x".repeat(100_000) }, { title: "keep", text: "needle" }], costDollars: { total: 0.007 } };
			if (method === "status") { started = true; return new Promise(resolve => { release = resolve; }); }
			if (method === "wait") return new Promise((_, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled")); }, { once: true }));
			throw new Error("host unavailable");
		},
	} as any);
	try {
		const fetched = await kernel.execute('const response = await exa.search("query");');
		expect(fetched.error).toBeUndefined();
		expect(fetched.output).toBe("");
		const filtered = await kernel.execute('show(response.results.filter(r => r.title === "keep")); show(response.costDollars.total);');
		expect(filtered.output).toContain("needle");
		expect(filtered.output).toContain("0.007");
		expect(filtered.output).not.toContain("discard");
		await kernel.execute('const job = wm.status(); notify(job, "workers");');
		await until(() => started);
		release([{ handle: "worker", status: "done" }]);
		await until(() => notices.length === 1);
		expect(notices[0].label).toBe("workers");
		expect((await kernel.execute('show((await job)[0].handle);')).output).toContain("worker");
		const controller = new AbortController();
		const waiting = kernel.execute('await wm.wait({ timeoutMs: 60000 });', controller.signal);
		const timer = setTimeout(() => controller.abort(), 150);
		try { expect((await waiting).error).toMatch(/cancel/i); } finally { clearTimeout(timer); }
		await until(() => aborted);
		expect((await kernel.execute('show(typeof response);')).output).toBe("undefined\n");
		const failed = await kernel.execute('show("before"); await board.list();');
		expect(failed.output).toBe("before\n");
		expect(failed.error).toContain("host unavailable");
	} finally { await kernel.dispose(); }
}, 15000);
