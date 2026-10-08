// The semaphore belongs to the host, not the spawning session or repository.
// GNU parallel owns locking and dead-holder reclamation; this file only observes the wait.
import { spawn } from "node:child_process";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { command, delay } from "./process";
import { threadDir, validId } from "./registry";

export interface Pressure { freePercent?: number; swapMB?: number }
export interface Admission {
	state: "queued" | "running";
	reason?: string;
	pid: number;
	since: string;
	slots: number;
	pressure?: Pressure;
}

const file = (id: string) => { validId(id); return join(threadDir(), id + ".admission"); };

export function readAdmission(id: string): Admission | undefined {
	let value: Admission;
	try { value = JSON.parse(readFileSync(file(id), "utf8")); }
	catch (error) { if ((error as { code?: string }).code === "ENOENT") return; throw error; }
	try { process.kill(value.pid, 0); }
	catch (error) { if ((error as { code?: string }).code === "ESRCH") return; throw error; }
	return value;
}

function setting(name: string, fallback: number): number {
	if (process.env[name] === undefined) return fallback;
	const n = Number(process.env[name]);
	if (!Number.isFinite(n) || n < 0) throw new Error(name + " must be a nonnegative number");
	return n;
}

function slots(): number {
	const n = setting("WORKER_SLOTS", 6);
	if (!Number.isSafeInteger(n) || n < 1) throw new Error("WORKER_SLOTS must be a positive integer");
	return n;
}

function record(id: string, state: Admission["state"], reason?: string, pressure?: Pressure) {
	const path = file(id), temp = path + "." + process.pid + ".tmp";
	const prior = readAdmission(id);
	const since = prior?.state === state && prior.reason === reason ? prior.since : new Date().toISOString();
	writeFileSync(temp, JSON.stringify({ state, reason, pressure, pid: process.pid, since, slots: slots() } satisfies Admission), { mode: 0o600 });
	renameSync(temp, path);
}

/** A trusted probe override prints JSON {freePercent, swapMB}, for forced-pressure trials. */
export async function pressure(): Promise<Pressure> {
	let p: Pressure;
	if (process.env.WORKER_PRESSURE_PROBE) p = JSON.parse(await command("/bin/sh", ["-c", process.env.WORKER_PRESSURE_PROBE]));
	else if (process.platform === "darwin") {
		const [memory, swap] = await Promise.all([command("memory_pressure", []), command("sysctl", ["vm.swapusage"])]);
		const free = /System-wide memory free percentage:\s*(\d+)%/.exec(memory);
		const used = /used\s*=\s*([\d.]+)M/.exec(swap);
		if (!free || !used) throw new Error("Cannot read macOS memory pressure/swap");
		p = { freePercent: Number(free[1]), swapMB: Number(used[1]) };
	} else return {}; // Slots still apply; the native pressure probe is macOS-only.
	if ((p.freePercent !== undefined && (!Number.isFinite(p.freePercent) || p.freePercent < 0 || p.freePercent > 100)) ||
		(p.swapMB !== undefined && (!Number.isFinite(p.swapMB) || p.swapMB < 0)) ||
		(p.freePercent === undefined && p.swapMB === undefined)) throw new Error("Invalid worker pressure probe result");
	return p;
}

/** Runs inside sem, before setup or pi. A pressure wait retains its reservation. */
export async function waitForMemory(id: string): Promise<void> {
	const min = setting("WORKER_MIN_FREE_PERCENT", 10);
	if (min > 100) throw new Error("WORKER_MIN_FREE_PERCENT must be at most 100");
	const maxSwap = setting("WORKER_MAX_SWAP_MB", Infinity);
	while (true) {
		let p: Pressure | undefined, reason: string | undefined;
		try {
			p = await pressure();
			reason = p.freePercent !== undefined && p.freePercent < min ? "memory free " + p.freePercent + "% < " + min + "%"
				: p.swapMB !== undefined && p.swapMB > maxSwap ? "swap " + p.swapMB + "MB > " + maxSwap + "MB" : undefined;
		} catch (error) { reason = "pressure probe: " + String(error); }
		record(id, reason ? "queued" : "running", reason, p);
		if (!reason) return;
		await delay(2_000);
	}
}

/** Foreground sem stays in the runner's process tree, so retirement reaches waiting and live holders. */
export async function workerSlot(id: string, argv: string[]): Promise<void> {
	record(id, "queued", "worker slots");
	try {
		await new Promise<void>((resolve, reject) => {
			const proc = spawn("sem", ["--id", "workers", "-j", String(slots()), "--fg", "-u", "-q", "--", ...argv], { stdio: "inherit" });
			// A waiting sem ignores TERM, but INT cancels it rather than eventually launching.
			const stop = () => proc.kill("SIGINT");
			for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, stop);
			const clear = () => { for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.off(signal, stop); };
			proc.once("error", error => { clear(); reject(error); });
			proc.once("exit", (code, signal) => {
				clear();
				if (code === 0) resolve(); else reject(new Error("Worker semaphore exited: " + (signal ?? code)));
			});
		});
	} finally { rmSync(file(id), { force: true }); }
}
