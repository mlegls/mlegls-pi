import { describe, expect, test } from "bun:test";
import { spawnEnv } from "./wm";

describe("spawnEnv", () => {
	test("carries identity, spawn provenance, and the fence ratio", () => {
		expect(spawnEnv({ run: "reorg/0918", handle: "a", agent: "auto", parentSession: "s1", checkpoint: "0.6" })).toEqual([
			"PI_WM_AGENT=auto",
			"PI_WM_RUN=reorg/0918",
			"PI_WM_HANDLE=a",
			"PI_WM_PARENT_SESSION=s1",
			"PI_CHECKPOINT=0.6",
		]);
	});

	test("drops absent optional values", () => {
		expect(spawnEnv({ run: "r", handle: "h" })).toEqual(["PI_WM_RUN=r", "PI_WM_HANDLE=h"]);
	});
});
