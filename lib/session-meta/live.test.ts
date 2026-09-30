import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markRetired, readLive, takeRetired, writeLive, writeLiveSubscriptions } from "./live";

// Unit: a session-meta turn-state write must not erase the board host's address/store snapshot.
test("turn state preserves the board subscription and its store", () => {
	const root = mkdtempSync(join(tmpdir(), "mail-live-"));
	const priorState = process.env.XDG_STATE_HOME;
	const priorBoard = process.env.PI_BOARD_DIR;
	try {
		process.env.XDG_STATE_HOME = join(root, "state");
		process.env.PI_BOARD_DIR = join(root, "board");
		const record = { pid: process.pid, sessionId: "00000000-0000-7000-8000-0000abcd1234", cwd: root, state: "idle" as const, since: new Date().toISOString() };
		writeLive(record);
		writeLiveSubscriptions(record.sessionId, root, [{ topic: "ticket/sample/feature", wake: true }]);
		writeLive({ ...record, state: "working" });
		expect(readLive().find(session => session.pid === process.pid)).toMatchObject({
		state: "working", boardDir: join(root, "board"), subscriptions: [{ topic: "ticket/sample/feature", wake: true }],
		});
	} finally {
		if (priorState === undefined) delete process.env.XDG_STATE_HOME;
		else process.env.XDG_STATE_HOME = priorState;
		if (priorBoard === undefined) delete process.env.PI_BOARD_DIR;
		else process.env.PI_BOARD_DIR = priorBoard;
		rmSync(root, { recursive: true, force: true });
	}
});

// Unit: a retirement mark silences exactly one exit of that session, not a later process reusing the pid.
test("a retirement mark is consumed once and bound to its session", () => {
	const root = mkdtempSync(join(tmpdir(), "mail-live-"));
	const priorState = process.env.XDG_STATE_HOME;
	try {
		process.env.XDG_STATE_HOME = join(root, "state");
		markRetired({ pid: 4242, sessionId: "a" });
		expect(takeRetired({ pid: 4242, sessionId: "a" })).toBe(true);
		expect(takeRetired({ pid: 4242, sessionId: "a" })).toBe(false);
		markRetired({ pid: 4242, sessionId: "a" });
		expect(takeRetired({ pid: 4242, sessionId: "b" })).toBe(false);
	} finally {
		if (priorState === undefined) delete process.env.XDG_STATE_HOME;
		else process.env.XDG_STATE_HOME = priorState;
		rmSync(root, { recursive: true, force: true });
	}
});
