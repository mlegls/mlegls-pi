import { lstat, readdir, unlink } from "node:fs/promises";
import type { Stats } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

const SOCKET_NAME = /^[A-Za-z0-9_-]{1,200}$/;

function socketDirectory(): string | undefined {
	const uid = process.getuid?.();
	if (uid === undefined) return undefined;
	return join(process.env.TMUX_TMPDIR || "/tmp", `tmux-${uid}`);
}

function socketPath(serverName: string): string | undefined {
	if (!SOCKET_NAME.test(serverName)) throw new Error(`Invalid tmux server name: ${serverName}`);
	const directory = socketDirectory();
	return directory ? join(directory, serverName) : undefined;
}

async function socketIsLive(path: string): Promise<boolean> {
	return await new Promise<boolean>((resolve) => {
		const socket = createConnection(path);
		let settled = false;
		const finish = (live: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			resolve(live);
		};
		const timer = setTimeout(() => finish(true), 500);
		socket.once("connect", () => finish(true));
		socket.once("error", (error: NodeJS.ErrnoException) => {
			finish(error.code !== "ECONNREFUSED" && error.code !== "ENOENT");
		});
	});
}

async function removeStaleSocket(serverName: string): Promise<void> {
	const path = socketPath(serverName);
	if (!path) return;
	let original: Stats;
	try {
		original = await lstat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
	if (!original.isSocket() || await socketIsLive(path)) return;

	try {
		const current = await lstat(path);
		if (current.isSocket() && current.dev === original.dev && current.ino === original.ino && !await socketIsLive(path)) {
			await unlink(path);
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

export async function sweepStaleTmuxSockets(prefix: string): Promise<void> {
	if (!SOCKET_NAME.test(prefix)) throw new Error(`Invalid tmux server prefix: ${prefix}`);
	const directory = socketDirectory();
	if (!directory) return;
	let names: string[];
	try {
		names = await readdir(directory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
	for (const name of names) {
		if (name.startsWith(prefix) && SOCKET_NAME.test(name)) await removeStaleSocket(name);
	}
}

export async function cleanupTmuxTestServer(serverName: string, killServer: () => Promise<void>): Promise<void> {
	let killError: unknown;
	let killFailed = false;
	try {
		await killServer();
	} catch (error) {
		killFailed = true;
		killError = error;
	}

	const path = socketPath(serverName);
	if (path && await socketIsLive(path)) {
		if (killFailed) throw killError;
		const deadline = Date.now() + 1_000;
		while (Date.now() < deadline && await socketIsLive(path)) {
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		if (await socketIsLive(path)) throw new Error(`tmux server ${serverName} remained live after kill-server`);
	}
	await removeStaleSocket(serverName);
}
