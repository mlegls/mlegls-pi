import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import guard from "../../../extensions/guard/index.ts";

const mode = process.argv[2] ?? "fresh";
if (!["fresh", "configured", "custom-default", "ignored-file"].includes(mode)) {
	throw new Error("Usage: bun replay.ts [fresh|configured|custom-default|ignored-file] ['shell command']");
}
const command = process.argv[3] ?? "git config --local core.hooksPath scripts/hooks";
const cwd = mkdtempSync(join(tmpdir(), "hook-enablement-"));
// A caller's Git selectors must not send fixture writes to a different checkout.
for (const key of Object.keys(process.env)) if (key.startsWith("GIT_")) delete process.env[key];
process.env.GIT_CONFIG_NOSYSTEM = "1";
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.PI_WM_HANDLE = "hook-enablement-replay";
const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "inherit" });
const hook = (dir: string, marker: string) => {
	mkdirSync(join(cwd, dir), { recursive: true });
	writeFileSync(join(cwd, dir, "pre-commit"), `#!/bin/sh\necho '${marker}'\n`, { mode: 0o755 });
};

try {
	git("init", "-q", "--template=");
	git("config", "user.name", "Hook replay");
	git("config", "user.email", "hook-replay@example.invalid");
	hook("scripts/hooks", "shipped pre-commit ran");
	git("add", "scripts/hooks");
	git("commit", "-qm", "Ship hook");
	mkdirSync(join(cwd, ".git/hooks"), { recursive: true });
	writeFileSync(join(cwd, ".git/hooks/pre-commit.sample"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
	if (mode === "ignored-file") {
		writeFileSync(join(cwd, ".gitignore"), "/scripts/hooks/post-commit\n");
		writeFileSync(join(cwd, "scripts/hooks/post-commit"), "#!/bin/sh\necho extra\n", { mode: 0o755 });
	} else if (mode === "configured") {
		hook("custom/hooks", "configured pre-commit ran");
		git("config", "--local", "core.hooksPath", "custom/hooks");
	} else if (mode === "custom-default") {
		hook(".git/hooks", "default pre-commit ran");
	}

	let onCall!: (event: { toolName: string; input: { command: string } }, ctx: { cwd: string }) => { block: true; reason: string } | undefined;
	guard({ on(name: string, handler: typeof onCall) { if (name === "tool_call") onCall = handler; } } as ExtensionAPI);
	const run = (command: string) => {
		console.log(`$ ${command}`);
		const refusal = onCall({ toolName: "bash", input: { command } }, { cwd });
		if (refusal) console.log(`Refused: ${refusal.reason}`);
		else execFileSync("bash", ["-c", command], { cwd, stdio: "inherit" });
	};
	run(command);
	run("git commit --allow-empty -m 'Check active hook'");
} finally {
	rmSync(cwd, { recursive: true, force: true });
}
