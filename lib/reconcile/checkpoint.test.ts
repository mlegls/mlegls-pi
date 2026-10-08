import { expect, test } from "bun:test";
import { checkpoint } from "./checkpoint";

test("a live-process checkpoint stays in its session and leaves budget for the eventual continuation", async () => {
	const chain = { retries: { checkpoint: 2 } as Record<string, number> };
	const calls: string[] = [];
	let repairMessage = "";
	const steps = {
		repair: async (message: string) => { calls.push("repair"); repairMessage = message; },
		raise: (reason: string) => { calls.push(reason); },
		restart: async () => { calls.push("restart"); chain.retries = {}; },
		save: () => { calls.push("save"); },
	};
	await checkpoint(chain, true, 3, steps);
	expect(calls).toEqual(["repair"]);
	expect(repairMessage).toContain("report `waiting`");
	expect(repairMessage).toContain("then checkpoint after it completes");
	expect(chain.retries.checkpoint).toBe(2);

	calls.length = 0;
	await checkpoint(chain, false, 3, steps);
	expect(calls).toEqual(["restart", "save"]);
	expect(chain.retries.checkpoint).toBe(3);
});
