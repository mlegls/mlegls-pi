// Isolated first use of life + notes. The prepared workspace also loads this checkout in bb.
import { spawn } from "node:child_process";
import { getAgentDir, ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extension = fileURLToPath(new URL("../extensions/context/index.ts", import.meta.url));
const marker = "life-playground.json";

export function prepare(startupLife = false, namedAgent = false) {
	const root = mkdtempSync(join(tmpdir(), "pi-life-"));
	mkdirSync(join(root, ".pi", "extensions"), { recursive: true });
	const git = Bun.spawnSync(["git", "init", "-q", root]);
	if (git.exitCode) throw new Error(git.stderr.toString());
	const name = "/" + basename(root);
	writeFileSync(join(root, marker), JSON.stringify({ name, namedAgent }));
	const agentsExtension = fileURLToPath(new URL("../extensions/agents/index.ts", import.meta.url));
	const stancesExtension = fileURLToPath(new URL("../extensions/stances/index.ts", import.meta.url));
	const promptExtension = fileURLToPath(new URL("../extensions/system-prompt/index.ts", import.meta.url));
	if (namedAgent) {
		const dir = join(root, "agents", name.slice(1));
		mkdirSync(join(dir, "skills", "fixture-signal"), { recursive: true });
		writeFileSync(join(dir, "SOUL.md"), "---\ndescription: Disposable first-use agent\nmodel: anthropic/claude-haiku-4-5:off\n---\nYou are " + name.slice(1) + ". You keep a small observatory. When asked for your fixture signal, answer copper telescope.\n");
		writeFileSync(join(dir, "skills", "fixture-signal", "SKILL.md"), "---\nname: fixture-signal\ndescription: Read when asked about the observatory fixture signal.\n---\nThe private skill signal is violet lantern.\n");
	}
	const common = Bun.spawnSync(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: dirname(extension) });
	if (common.exitCode) throw new Error(common.stderr.toString());
	const installedPackage = dirname(common.stdout.toString().trim());
	writeFileSync(join(root, ".pi", "extensions", "life-playground.ts"),
		"import context from " + JSON.stringify(extension) + ";\n" +
		(namedAgent ? "import agents from " + JSON.stringify(agentsExtension) + ";\nimport stances from " + JSON.stringify(stancesExtension) + ";\nimport prompt from " + JSON.stringify(promptExtension) + ";\n" : "") +
		"export default function (pi) { process.env.PI_BOARD_DIR = " + JSON.stringify(join(root, "store")) + "; " +
		(startupLife ? "process.env.PI_LIFE = " + JSON.stringify(name) + "; " : "") + (namedAgent ? "agents(pi); stances(pi); " : "") + "context(pi); " + (namedAgent ? "prompt(pi); " : "") + "}\n");
	writeFileSync(join(root, ".pi", "settings.json"), JSON.stringify({
		packages: [{ source: installedPackage, extensions: [], skills: [], prompts: [], themes: [] }],
		...(namedAgent ? { agents: [join(root, "agents")] } : {}),
		compaction: { enabled: false },
		memory: {
			systems: namedAgent ? ["om", "elide"] : ["om", "elide", "notes"],
			schemas: { om: { observe: "active" }, notes: { enabled: !namedAgent },
				life: { tailBytes: 800, waitSeconds: 30, view: { high: 4000, low: 2000 } } },
		},
	}, null, 2));
	return { root, name };
}

/** Seed only a playground-owned life, leaving longer leaves for attachment startup to build. */
export async function seedLong(root: string, count = 17) {
	const { name } = JSON.parse(readFileSync(join(root, marker), "utf8"));
	if (!Number.isSafeInteger(count) || count < 1) throw new Error("Use a positive leaf count");
	const previous = process.env.PI_BOARD_DIR;
	process.env.PI_BOARD_DIR = join(root, "store");
	try {
		const { lifeLog } = await import("../extensions/context/life/log.ts");
		const added = lifeLog(name).append(Array.from({ length: count }, (_, i) => ({
			kind: "user" as const, text: "Playground observation " + i + ". " + "The copper telescope recorded a violet lantern in the northern sky. ".repeat(40),
			place: "playground-import", source: "entry:playground-import/long-" + i + "#0",
			model: "fixture/import", date: new Date().toISOString(),
		})));
		return { root, name, added: added.length, total: lifeLog(name).read().length };
	} finally {
		if (previous === undefined) delete process.env.PI_BOARD_DIR;
		else process.env.PI_BOARD_DIR = previous;
	}
}

export function launch(root: string, slot: string, args: string[] = [], pipe = false) {
	const { name, namedAgent } = JSON.parse(readFileSync(join(root, marker), "utf8"));
	if (!/^[a-z0-9-]+$/.test(slot)) throw new Error("Use a simple session slot, e.g. one or two");
	const detached = args.includes("--no-life-env");
	args = args.filter((a) => a !== "--no-life-env");
	const env: NodeJS.ProcessEnv = { ...process.env, PI_BOARD_DIR: join(root, "store") };
	// These are terminal sessions. Real bb sessions supply their own identity.
	delete env.BB_THREAD_ID;
	delete env.PI_WM_HANDLE;
	delete env.PI_CHECKPOINT;
	delete env.PI_LIFE;
	if (!detached && !namedAgent) env.PI_LIFE = name;
	return spawn("pi", [
		"--approve", "--no-extensions", "-e", namedAgent ? join(root, ".pi", "extensions", "life-playground.ts") : extension, "--no-skills", "--no-prompt-templates", "--no-themes",
		// A caller's model, with or without its provider, replaces the default one.
		...(args.includes("--model") || args.includes("--provider") ? [] : ["--provider", namedAgent && !detached ? "agent" : "anthropic", "--model", namedAgent && !detached ? name.slice(1) : "claude-haiku-4-5"]), "--thinking", "off",
		"--session-dir", join(root, "sessions", slot),
		...(["--fork", "--session", "--session-id", "--resume", "--no-session"].some((flag) => args.includes(flag)) ? [] : ["--continue"]), ...args,
	], { cwd: root, env, stdio: pipe ? ["pipe", "pipe", "pipe"] : "inherit" });
}

if (import.meta.main) {
	const [command, target, slot, ...args] = process.argv.slice(2);
	if (["prepare", "prepare-bb", "prepare-agent", "prepare-agent-bb"].includes(command)) {
		const setup = prepare(command === "prepare-bb", command.startsWith("prepare-agent"));
		if (command.endsWith("-bb")) new ProjectTrustStore(getAgentDir()).set(setup.root, true);
		console.log(JSON.stringify(setup, null, 2));
	} else if (command === "seed-long" && target) {
		console.log(JSON.stringify(await seedLong(resolve(target), slot === undefined ? 17 : Number(slot)), null, 2));
	} else if (command === "untrust" && target) {
		readFileSync(join(resolve(target), marker));
		new ProjectTrustStore(getAgentDir()).set(resolve(target), null);
	}
	else if (command === "start" && target && slot) {
		const child = launch(resolve(target), slot, args);
		child.on("exit", (code) => process.exit(code ?? 1));
	} else {
		console.error("bun scripts/life-playground.ts prepare[-agent][-bb]\nbun scripts/life-playground.ts seed-long <root> [count]\nbun scripts/life-playground.ts start <root> <one|two> [--no-life-env] [pi options]");
		process.exitCode = 1;
	}
}
