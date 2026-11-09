// Keyless library/CLI entry point. Registry/auth are fixtures; replay uses an isolated agent directory.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Runtime } from "../../../extensions/context/om/runtime.ts";

const sessionModel = { provider: "fixture-session", id: "foreground" };
const configuredModel = { provider: "fixture-om-missing", id: "no-such-model" };
const selector = configuredModel.provider + "/" + configuredModel.id;
const mode = process.argv[2] ?? "headless";
if (mode === "replay" || mode === "condenser") {
	const scratch = mkdtempSync(join(tmpdir(), "om-model-first-use-"));
	try {
		const agentDir = join(scratch, "agent");
		mkdirSync(agentDir);
		const input = join(scratch, "input.json");
		writeFileSync(input, JSON.stringify({ version: 1, session: "om-model-first-use", source: "synthetic", sourceSha256: "synthetic", entries: [] }, null, 2));
		const child = Bun.spawn([process.execPath, "extensions/context/om/session-ledger/replay-upstream.ts", mode === "condenser" ? "--condenser" : "--workers", input, join(scratch, "output"), selector], {
			cwd: new URL("../../../", import.meta.url).pathname,
			env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
			stdout: "inherit", stderr: "inherit",
		});
		process.exitCode = await child.exited;
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
} else {
	const runtime = new Runtime();
	runtime.config.model = configuredModel;
	const result = await runtime.resolveModel({
		model: sessionModel,
		modelRegistry: {
			find: () => mode === "configured" ? configuredModel : undefined,
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "fixture-key-never-sent" }),
		},
		hasUI: mode === "ui",
		ui: mode === "ui" ? { notify: (message, level) => console.log(JSON.stringify({ notification: message, level })) } : undefined,
	});
	console.log(JSON.stringify(result.ok ? { ok: true, used: result.model } : result));
}
