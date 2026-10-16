import { expect, test } from "bun:test";
import { checkpoint } from "./checkpoint";

const harness = () => {
	const chain = { retries: {} as Record<string, number> };
	const calls: string[] = [];
	const steps = {
		resume: async () => { calls.push("resume"); },
		raise: (reason: string) => { calls.push(reason); },
		restart: async () => { calls.push("restart"); chain.retries = {}; },
		save: () => { calls.push("save"); },
	};
	return { chain, calls, steps };
};

test("a live worker's checkpoint resumes the same worker; observation failure counts as live", async () => {
	const { chain, calls, steps } = harness();
	await checkpoint(chain, true, 3, steps);
	await checkpoint(chain, undefined, 3, steps);
	expect(calls).toEqual(["resume", "save", "resume", "save"]);
	expect(chain.retries.checkpoint).toBe(2);
});

test("only a worker that is gone gets a successor, and the count survives the phase restart", async () => {
	const { chain, calls, steps } = harness();
	chain.retries.checkpoint = 1;
	await checkpoint(chain, false, 3, steps);
	expect(calls).toEqual(["restart", "save"]);
	expect(chain.retries.checkpoint).toBe(2);
});

test("checkpoints past the budget raise instead of continuing", async () => {
	const { chain, calls, steps } = harness();
	chain.retries.checkpoint = 3;
	await checkpoint(chain, true, 3, steps);
	expect(calls).toEqual(["checkpointed 3 times"]);
});
