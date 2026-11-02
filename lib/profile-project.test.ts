import { expect, test } from "bun:test";
import { projectReport } from "./profile-project.ts";

// Acceptance of profile-host-flag-fails-whole-run-when-a-host-is-unreachable: .invalid never resolves,
// so ssh exits 255 before any remote command runs.
test("an unreachable --host is reported unaudited and the local run still returns", async () => {
	const out = await projectReport(
		{ project: "no-such-project-for-profile-test", since: Date.now() },
		{ hosts: ["profile-unreachable.invalid"], byThread: true, last: 5, json: false },
	);
	expect(out.split("\n")[0]).toMatch(/^host profile-unreachable\.invalid unreachable: .+ \(unaudited\)$/);
});
