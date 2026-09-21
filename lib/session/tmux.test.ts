import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TmuxTerminalManager, tmuxAvailable } from "./tmux";

const managers: TmuxTerminalManager[] = [];

function manager(): TmuxTerminalManager {
	const instance = new TmuxTerminalManager(`pi-terminal-test-${randomUUID().slice(0, 12)}`);
	managers.push(instance);
	return instance;
}

afterEach(async () => {
	await Promise.all(managers.splice(0).map((instance) => instance.killServer()));
});

describe.skipIf(!tmuxAvailable())("TmuxTerminalManager", () => {
	test("captures output and exit status from a completed command", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		const command = "printf 'hello world\\n'\nprintf 'second line\\n'";
		const spawned = await instance.spawn({ command, cwd, name: "echo" });
		const snapshot = spawned.status === "exited" ? spawned : await instance.view({ id: "echo", waitMs: 2_000 });

		expect(snapshot.status).toBe("exited");
		expect(snapshot.exitCode).toBe(0);
		expect(snapshot.output).toContain("hello world");
		expect(snapshot.output).toContain("second line");
		expect(snapshot.command).toBe(command);
		expect(snapshot.cwd).toBe(cwd);
	});

	test("keeps shell state across send calls", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		await instance.spawn({ command: "sh", cwd, name: "shell" });
		await instance.send("shell", "value=41");
		const snapshot = await instance.send("shell", "echo $((value + 1))");

		expect(snapshot.status).toBe("running");
		expect(snapshot.output).toContain("42");
		const listed = await instance.list();
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe("shell");
	});

	test("waits for output to change from a previous cursor", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		const initial = await instance.spawn({ command: "sh", cwd, name: "waiting" });
		const send = new Promise<void>((resolveSend, reject) => {
			setTimeout(() => {
				instance.send("waiting", "echo changed").then(() => resolveSend(), reject);
			}, 150);
		});
		const changed = await instance.view({ id: "waiting", cursor: initial.cursor, waitMs: 2_000 });
		await send;

		expect(changed.timedOut).not.toBe(true);
		expect(changed.cursor).not.toBe(initial.cursor);
		expect(changed.output).toContain("changed");
	});

	test("wait any returns the first terminal to exit", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		await instance.spawn({ command: "sleep 30", cwd, name: "slow" });
		await instance.spawn({ command: "sleep 0.2; echo fast done", cwd, name: "fast" });
		const result = await instance.waitMany({ ids: ["slow", "fast"], mode: "any", waitMs: 5_000 });

		expect(result.timedOut).not.toBe(true);
		expect(result.changed).toEqual(["fast"]);
		const fast = result.snapshots.find((snapshot) => snapshot.id === "fast");
		expect(fast?.status).toBe("exited");
		expect(fast?.output).toContain("fast done");
		expect(result.snapshots.find((snapshot) => snapshot.id === "slow")?.status).toBe("running");
	});

	test("wait any detects output changes from provided cursors", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		const quiet = await instance.spawn({ command: "sh", cwd, name: "quiet" });
		const noisy = await instance.spawn({ command: "sh", cwd, name: "noisy" });
		const send = new Promise<void>((resolveSend, reject) => {
			setTimeout(() => {
				instance.send("noisy", "echo changed").then(() => resolveSend(), reject);
			}, 150);
		});
		const result = await instance.waitMany({
			ids: ["quiet", "noisy"],
			mode: "any",
			cursors: { quiet: quiet.cursor, noisy: noisy.cursor },
			waitMs: 5_000,
		});
		await send;

		expect(result.timedOut).not.toBe(true);
		expect(result.changed).toEqual(["noisy"]);
		expect(result.snapshots.find((snapshot) => snapshot.id === "noisy")?.output).toContain("changed");
	});

	test("wait all returns once every terminal has exited", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		await instance.spawn({ command: "sleep 0.2; echo one", cwd, name: "one" });
		await instance.spawn({ command: "sleep 0.4; echo two", cwd, name: "two" });
		const result = await instance.waitMany({ ids: ["one", "two"], mode: "all", waitMs: 5_000 });

		expect(result.timedOut).not.toBe(true);
		expect(result.changed.sort()).toEqual(["one", "two"]);
		for (const snapshot of result.snapshots) {
			expect(snapshot.status).toBe("exited");
			expect(snapshot.exitCode).toBe(0);
		}
	});

	test("wait times out when nothing changes", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		await instance.spawn({ command: "sleep 30", cwd, name: "idle" });
		const result = await instance.waitMany({ ids: ["idle"], mode: "any", waitMs: 300 });

		expect(result.timedOut).toBe(true);
		expect(result.changed).toEqual([]);
	});

	test("sends control keys and ends sessions", async () => {
		const instance = manager();
		const cwd = await mkdtemp(join(tmpdir(), "pi-terminal-test-"));
		await instance.spawn({ command: "sleep 30", cwd, name: "sleeper" });
		const interrupted = await instance.sendRaw("sleeper", ["C-c"]);
		const exited = interrupted.status === "exited"
			? interrupted
			: await instance.view({ id: "sleeper", waitMs: 2_000 });
		expect(exited.status).toBe("exited");
		await instance.end("sleeper");
		expect(await instance.list()).toEqual([]);
	});
});
