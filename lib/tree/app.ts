// The native thread app (apps/threads) is a view: it lists with `ab thread ls --json`,
// attaches with `ab thread attach --exclusive`, and performs sidebar actions through `ab tree do`,
// which shares lib/tree/actions.ts with the TUI sidebar.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { abandonThread, archiveThread, getThread, integrateThread, seeThread } from "../thread";
import * as act from "./actions";
import { threadEnv } from "./ghostty";

const APP = fileURLToPath(new URL("../../apps/threads", import.meta.url));
const AB = fileURLToPath(new URL("../../bin/ab", import.meta.url));

/** Builds, installs ~/Applications/Threads.app (so the Dock launches it as an app, not a script in Terminal),
 * and opens it. Launched by LaunchServices it has launchd's bare environment, so it asks a login shell
 * for `ab tree env` first (THREADS_RESOLVE_ENV), as VS Code and Zed resolve theirs. */
export async function launchApp(): Promise<void> {
	const build = spawnSync("swift", ["build", "-c", "release", "--package-path", APP], { stdio: ["ignore", "inherit", "inherit"] });
	if (build.status !== 0) throw new Error("swift build failed");
	const bundle = installApp(homedir() + "/Applications/Threads.app");
	spawnSync("open", [bundle], { stdio: "inherit" });
}

/** extra: more LSEnvironment, e.g. THREADS_STATE for a dev copy. */
export function installApp(bundle: string, extra: Record<string, string> = {}): string {
	mkdirSync(bundle + "/Contents/MacOS", { recursive: true });
	copyFileSync(APP + "/.build/release/Threads", bundle + "/Contents/MacOS/Threads");
	writeFileSync(bundle + "/Contents/Info.plist", plist({
		CFBundleIdentifier: "dev.mlegls.threads", CFBundleName: "Threads", CFBundleExecutable: "Threads",
		CFBundlePackageType: "APPL", CFBundleShortVersionString: "0.1", LSMinimumSystemVersion: "14.0",
		NSHighResolutionCapable: true, LSEnvironment: { AB_BIN: AB, THREADS_RESOLVE_ENV: "1", ...extra } }));
	spawnSync("codesign", ["--force", "--sign", "-", bundle], { stdio: "ignore" });
	return bundle;
}

function plist(dict: Record<string, unknown>): string {
	const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
	const value = (v: unknown): string => typeof v === "boolean" ? (v ? "<true/>" : "<false/>")
		: typeof v === "object" && v ? "<dict>" + Object.entries(v).map(([k, x]) => "<key>" + esc(k) + "</key>" + value(x)).join("") + "</dict>"
		: "<string>" + esc(String(v)) + "</string>";
	return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">' + value(dict) + "</plist>\n";
}

/** The environment threads should inherit, between markers so a chatty login shell can't corrupt it. */
export function printEnv(): void {
	process.stdout.write("\x1eENV" + JSON.stringify(threadEnv()) + "\x1eENV");
}

const ACTIONS = ["new", "fork", "open", "open-new", "merge", "continue", "abandon", "seen"] as const;
const USAGE = "usage: ab tree do new|fork [--id ID] [--sibling] [--name BRANCH] [--project QUERY [--init]] | open|open-new --project QUERY [--init] | merge|continue|abandon|seen --id ID";

export async function perform(args: string[]): Promise<void> {
	try {
		const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
			id: { type: "string" }, name: { type: "string" }, project: { type: "string" }, sibling: { type: "boolean" }, init: { type: "boolean" } } });
		const kind = positionals[0] as typeof ACTIONS[number];
		if (!ACTIONS.includes(kind)) throw new Error(USAGE);
		console.log(JSON.stringify(await run(kind, values)));
	} catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
}

async function run(kind: typeof ACTIONS[number], values: { id?: string; name?: string; project?: string; sibling?: boolean; init?: boolean }) {
	const thread = values.id ? await getThread(values.id) : undefined;
	if (values.id && (!thread || thread.archived)) throw new Error("No active thread: " + values.id);
	if (kind === "open" || kind === "open-new") return { thread: (await act.openProject(values.project ?? "", values.init, kind === "open-new")).id };
	if (kind === "new" || kind === "fork") return { thread: (await act.spawn(kind, thread, values)).id };
	if (!thread) throw new Error("Select a thread");
	if (kind === "seen") { await seeThread(thread.id); return {}; }
	if (kind === "continue") { await integrateThread(thread.id); return {}; }
	const result = kind === "abandon" ? await abandonThread(thread.id) : await archiveThread(thread.id);
	if (result.blocked) throw new Error("Blocked at " + result.blocked.threadId + ": " + result.blocked.block.reason);
	return { closed: result.closed };
}
