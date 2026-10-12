import { expect, test } from "bun:test";
import { schedulingView } from "./scheduling";
import { protocolFixture } from "./protocol-fixture";

test("collector-local landings release remaining work without releasing canonical outside blockers or foreign claims", () => {
	const f = protocolFixture();
	try {
		f.create("a", { "part-of": "root", assignee: "human", priority: 4, "claimed-by": "reconcile:root" });
		f.create("b", { "part-of": "root", "blocked-by": ["a"] });
		f.create("outside", { "blocked-by": ["a"] });
		const canonical = f.tracker.snapshot(), before = structuredClone([...canonical]);
		const context = { root: "root", into: "root", landed: {
			a: { into: "root", head: "code-head", at: new Date().toISOString() },
		}, attemptClaims: new Set<string>(), withheld: new Set<string>() };
		const local = schedulingView(canonical, context);
		expect(local.get("a")?.satisfied).toBe(true);
		expect(local.get("a")?.done).toBe(false);
		expect(local.get("b")?.frontier).toBe(true);
		expect(local.get("root")?.eligible).toBe(true);
		expect(local.get("root")?.deferred).toBe(false);
		expect(local.get("root")?.selectors).toEqual([
			{ slug: "root", assignee: "agent" }, { slug: "b", assignee: "agent" },
		]);
		const elsewhere = schedulingView(canonical, { ...context, into: f.cwd });
		expect(elsewhere.get("b")?.frontier).toBe(false);
		expect(elsewhere.get("outside")?.blockers).toEqual(["a"]);
		expect(elsewhere.get("outside")?.frontier).toBe(false);

		f.tracker.update("a", { "claimed-by": "session:foreign" });
		expect(schedulingView(f.tracker.snapshot(), context).get("root")?.frontier).toBe(false);
		f.tracker.update("a", { "claimed-by": "reconcile:root/refine" });
		const provisional = schedulingView(f.tracker.snapshot(), { ...context,
			attemptClaims: new Set(["reconcile:root/refine"]), withheld: new Set(["a"]),
		});
		expect(provisional.get("a")?.satisfied).toBe(false);
		expect(provisional.get("root")?.frontier).toBe(false);
		expect([...canonical]).toEqual(before);
		expect(canonical.get("a")?.done).toBe(false);
		expect(f.tracker.snapshot().get("outside")?.frontier).toBe(false);
	} finally { f.close(); }
});
