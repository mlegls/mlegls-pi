import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { openForkTab } from "./fork-tab";

test("fork snapshots the live branch, launches in the originating session, and leaves the parent alone", async () => {
	const root = await mkdtemp(join(tmpdir(), "pi-fork-test-"));
	const parent = SessionManager.create(root, root);
	const first = parent.appendMessage({ role: "user", content: "keep", timestamp: 1 });
	parent.appendMessage({ role: "user", content: "not on active branch", timestamp: 2 });
	parent.branch(first);
	const source = parent.getSessionFile();
	const ctx = { cwd: root, sessionManager: parent, waitForIdle: async () => {}, ui: { notify() {} } } as unknown as ExtensionCommandContext;
	let file: string | undefined;
	try {
		await openForkTab(ctx, "", async (command, args) => {
			expect(command).toBe("tmux");
			if (args[0] === "display-message") {
				expect(args).toContain("%42");
				return "$7\n";
			}
			expect(args.slice(0, 5)).toEqual(["new-window", "-t", "$7:", "-c", root]);
			file = args.at(-1)!;
			const fork = SessionManager.open(file);
			expect(fork.getHeader()?.parentSession).toBe(source);
			expect(fork.getEntries().map(e => e.id)).toEqual([first]);
			return "";
		}, "%42");
		expect(parent.getSessionFile()).toBe(source);
		expect(parent.getEntries()).toHaveLength(2);
	} finally {
		if (file) await rm(file, { force: true });
		await rm(root, { recursive: true, force: true });
	}
});

test("worktree root becomes cwd; failed window creation removes the fork", async () => {
	const root = await mkdtemp(join(tmpdir(), "pi-fork-test-"));
	const parent = SessionManager.create(root, root);
	const ctx = { cwd: root, sessionManager: parent, waitForIdle: async () => {}, ui: { notify() {} } } as unknown as ExtensionCommandContext;
	let file = "";
	try {
		await expect(openForkTab(ctx, "topic", async (command, args) => {
			if (command === "cyber-mux") {
				expect(args).toEqual(["worktree", "add", "--branch=topic", "--format", "json"]);
				return JSON.stringify({ root: join(root, "worktree") });
			}
			if (args[0] === "display-message") return "$7";
			expect(args[4]).toBe(join(root, "worktree"));
			file = args.at(-1)!;
			throw new Error("window failed");
		}, "%42")).rejects.toThrow("window failed");
		await expect(readFile(file)).rejects.toThrow();
		await expect(openForkTab(ctx, "topic", async () => { throw new Error("unexpected execution"); }, "")).rejects.toThrow("requires tmux");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
