import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmod, copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
let scratch: string;
// Replay the CLI user's sleeping-jg drive in a disposable copy of the CLI.
// Never replace the checkout's bin/jg: other tests and users may invoke it concurrently.
beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), "ab-jg-cli-"));
	await cp(join(root, "ab"), join(scratch, "ab"), { recursive: true });
	await mkdir(join(scratch, "bin"));
	await copyFile(join(root, "bin/ab"), join(scratch, "bin/ab"));
	await chmod(join(scratch, "bin/ab"), 0o755);
	for (const dir of ["lib", "extensions", "node_modules"]) await symlink(join(root, dir), join(scratch, dir));
	await writeFile(join(scratch, "bin/jg"), '#!/bin/sh\nprintf "%s\\n" "$$" > "$AB_JG_TEST_PID_FILE"\nprintf "%s\\n" "$@" > "$AB_JG_TEST_ARGS_FILE"\nexec sleep 60\n');
	await chmod(join(scratch, "bin/jg"), 0o755);
});
afterAll(async () => {
	if (scratch) await rm(scratch, { recursive: true, force: true });
});

async function invoke(name: string, args: string[]) {
	const pidFile = join(scratch, `${name}.pid`);
	const argsFile = join(scratch, `${name}.args`);
	const child = Bun.spawn(args, { cwd: scratch, env: { ...process.env, AB_SESSION_STATE: join(scratch, "state"), AB_JG_TEST_PID_FILE: pidFile, AB_JG_TEST_ARGS_FILE: argsFile }, stdout: "pipe", stderr: "pipe" });
	try {
		const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
		return { stdout, stderr, exitCode, pidFile, argsFile };
	} finally {
		// In the 0-off trial an external timeout stops ab, not necessarily its stub.
		const pid = Number(await readFile(pidFile, "utf8").catch(() => "0"));
		if (pid) { try { process.kill(pid, "SIGKILL"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; } }
		if (child.exitCode === null) child.kill("SIGKILL");
	}
}

test("CLI drive: explicit deadline ends a hanging repository-wide query with incomplete exit and exact-search fallback", async () => {
	const result = await invoke("wide", ["./bin/ab", "jg", "--deadline", "1", "q", "."]);
	expect(result.exitCode).toBe(2);
	expect(result.stderr).toMatch(/jg "q": \d+\.\ds, deadline 1s, killed before a result; use ab grep for exact search/);
	expect(result.stdout).toBe("");
	expect((await readFile(result.argsFile, "utf8")).split("\n")).not.toContain("--deadline");
	const pid = Number(await readFile(result.pidFile, "utf8"));
	expect(() => process.kill(pid, 0)).toThrow();
}, 10000);

test("CLI drive: trailing deadline also bounds a narrower query", async () => {
	const result = await invoke("narrow", ["./bin/ab", "jg", "q", "ab", "--deadline", "2"]);
	expect(result.exitCode).toBe(2);
	expect(result.stderr).toMatch(/jg "q": \d+\.\ds, deadline 2s, killed before a result; use ab grep for exact search/);
}, 10000);

test("CLI drive: zero disables the internal deadline so an external timeout fires first", async () => {
	const result = await invoke("off", ["timeout", "-k", "1", "2", "./bin/ab", "jg", "--deadline", "0", "q", "."]);
	expect(result.exitCode).toBe(124);
	expect(result.stderr).not.toContain("deadline 0s");
	expect(result.stderr).not.toContain("killed before a result");
}, 10000);

test("CLI drive: help explains the default, override, off mode, incomplete result and fallback", async () => {
	const result = await invoke("help", ["./bin/ab", "jg", "--help"]);
	expect(result.exitCode).toBe(0);
	expect(result.stdout).toContain("--deadline SECONDS");
	expect(result.stdout).toContain("default 180");
	expect(result.stdout).toContain("0 waits indefinitely");
	expect(result.stdout).toContain("exit status is 2 (incomplete)");
	expect(result.stdout).toContain("exact ab grep");
}, 10000);
