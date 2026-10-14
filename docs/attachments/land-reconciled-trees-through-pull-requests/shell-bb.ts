// One-off no-model worker surface: production BB transport/registry with the
// existing fake CLI, plus deterministic shell actions at thread spawn.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeBb } from "../../../lib/thread/fake-bb.ts";

export function shellBb(root: string, command: string) {
	fakeBb(root);
	const delegate = process.env.BB_CLI!;
	const cli = join(root, "fake-bb", "shell-bb");
	writeFileSync(cli, "#!/bin/sh\nexec " + JSON.stringify(process.execPath) + " " + JSON.stringify(import.meta.path) + ' "$@"\n', { mode: 0o755 });
	Object.assign(process.env, { BB_CLI: cli, SHELL_BB_DELEGATE: delegate, SHELL_BB_COMMAND: command });
}
if (import.meta.main) {
	const args = process.argv.slice(2);
	if (args[0] === "thread" && args[1] === "spawn") {
		const cwd = args[args.indexOf("--environment") + 1]!;
		execFileSync("bash", ["-c", process.env.SHELL_BB_COMMAND!], { cwd, stdio: ["ignore", "ignore", "pipe"] });
	}
	process.stdout.write(execFileSync(process.env.SHELL_BB_DELEGATE!, args, { encoding: "utf8" }));
}
