import { expect, test } from "bun:test";
import { projectReport } from "./profile-project.ts";
import { epoch, runFixture } from "./profile-run.fixture.ts";
import type { Profile } from "./profile.ts";

// Acceptance of profile-host-flag-fails-whole-run-when-a-host-is-unreachable: .invalid never resolves,
// so ssh exits 255 before any remote command runs.
test("an unreachable --host is reported unaudited and the local run still returns", async () => {
	const out = await projectReport(
		{ project: "no-such-project-for-profile-test", since: Date.now() },
		{ hosts: ["profile-unreachable.invalid"], byThread: true, last: 5, json: false },
	);
	expect(out.split("\n")[0]).toMatch(/^host profile-unreachable\.invalid unreachable: .+ \(unaudited\)$/);
});

// A rewind keeps a copy of the old owner replies; the currently selected owner did no work in either run.
test("--run uses worker bounds and separates additive worker cost from overlapping owner spend", () => {
	const get = (slug: string): Profile => JSON.parse(runFixture(slug, "--json"));
	const alpha = get("alpha"), beta = get("beta");
	expect([alpha.start, alpha.end, beta.start, beta.end].map(t => (t - epoch) / 1000)).toEqual([10, 60, 30, 80]);
	expect(alpha.run).toEqual({ slug: "alpha", workerCost: 6, ownerCost: 17 });
	expect(beta.run).toEqual({ slug: "beta", workerCost: 5, ownerCost: 16 });
	expect(alpha.run!.workerCost + beta.run!.workerCost).toBe(2 + 1 + 3 + 5);
	expect(runFixture("alpha").split("\n").slice(0, 3)).toEqual([
		expect.stringMatching(/^run alpha: 2 worker sessions, span 50s,/),
		"worker-only cost: $6.00",
		"overlapping owner cost: $17.00",
	]);
});
