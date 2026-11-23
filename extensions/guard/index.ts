// Refuse host-wide kills by pattern. Many workers share this host: `pkill -f 'bun test'` from one checkout killed
// other workers' pi processes, whose argv carried their bootstrap prompt (docs/issues/workers-crash-on-uncaught-epipe.md
// has the neighbouring history). Stop what you started by pid, or through the process tool or the checkout's own stop task.
//
// Workers also may not bypass a project's git hooks: drivers committed with `git -c core.hooksPath=/dev/null commit`, and the
// commits escaped concept's pre-commit formatter (concept docs/attachments/worker-commits-escape-the-pre-commit-formatter).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { accessSync, constants, lstatSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { parse, statusRepairMessage } from "../../lib/report.ts";
import { checkout, git } from "../../lib/thread/git.ts";
import { managedProcess } from "../../lib/thread/process.ts";

const TRACKER = "Use the global tracker: `bun ~/.pi/agent/skills/tracker/scripts/issues.ts text <slug|attachments/file.md>` (also `update`, `fields`, `tree`).";
const INTEGRATION = "Commit on your worker branch and report your handoff; your parent integrates and publishes it.";
const PROMISED_WAKE = /\b(?:when|once)\b.{0,80}\b(?:(?:finish|pass)(?:es)?|(?:end|land|complete)s?)\b.{0,40}\bI['’]ll\b|\bwakes me\b/i;
const NO_WAKE = "Nothing is running that will wake this thread. Wait in the foreground with process wait, or hand the wait to an automation.";
const KILL = "pkill/killall match processes host-wide, including other sessions' workers. Stop processes you started by pid (kill <pid>), with the process tool, or with the checkout's own stop task.";

// Read literal shell words and command boundaries; quoted prose stays inside its argument.
function* commands(source: string): Generator<string[]> {
	let argv: string[] = [];
	for (const [token] of source.matchAll(/#[^\n]*|[;&|()\n]|(?:"(?:\\.|[^"\\])*"|'[^']*'|\\[\s\S]|[^\s"'\\;&|()])+/g)) {
		if (/^[;&|()\n]$/.test(token)) {
			if (argv.length) yield argv;
			argv = [];
		} else if (!token.startsWith("#")) {
			argv.push(token.replace(/"((?:\\.|[^"\\])*)"|'([^']*)'|\\([\s\S])/g, (_, double, single, escaped) => double?.replace(/\\(["\\$`])/g, "$1") ?? single ?? escaped));
		}
	}
	if (argv.length) yield argv;
}

function shellPath(cwd: string, path: string): string {
	return resolve(cwd, path.replace(/^~(?=\/|$)/, homedir()).replace(/^\$(?:PWD|\{PWD\})(?=\/|$)/, cwd));
}

function issuePath(word: string, cwd: string): boolean {
	const path = word.replace(/^(?:--[\w-]+=|[\w/.^~@-]+:|[<>]+)/, "");
	return /(?:^|\/)docs\/issues(?:\/|$)/.test(shellPath(cwd, path));
}

function gitConfig(cwd: string, key: string): string | undefined {
	try { return git(cwd, "config", "--get", key); } catch { return undefined; }
}

function integration(name: string, args: string[], cwd: string, worker: string): string | undefined {
	if (name === "git") {
		while (args[0]?.startsWith("-")) {
			const flag = args.shift()!;
			if (flag === "-C" && args.length) cwd = shellPath(cwd, args.shift()!);
			else if (["-c", "--config-env"].includes(flag)) args.shift();
		}
		if (args[0] !== "merge" && args[0] !== "push") return;
	} else if (name !== "ab" || args[0] !== "task" || args[1] !== "finish") return;

	try {
		const here = checkout(cwd);
		if (name === "git" && args[0] === "merge") return here.worktree ? undefined : INTEGRATION;
		const canonical = checkout(here.project).branch;
		const target = gitConfig(cwd, `branch.${worker}.ab-parent`);
		if (name === "ab") {
			const into = gitConfig(cwd, `branch.${here.branch}.ab-parent`) ?? (args.includes("--into") ? args[args.indexOf("--into") + 1] : undefined);
			if (!here.worktree || here.branch === worker || (canonical && into === canonical)) return INTEGRATION;
			return;
		}
		const protectedBranches = [canonical, target].filter(Boolean);
		const isProtected = (ref: string | undefined) => !!ref && protectedBranches.includes(ref.replace(/^refs\/heads\//, ""));
		if (!protectedBranches.length) return;
		const flags = args.slice(1);
		if (flags.some(flag => ["--all", "--branches", "--mirror"].includes(flag))) return INTEGRATION;
		const positionals = flags.filter((arg, i) => !arg.startsWith("-") && !["-o", "--push-option", "--receive-pack", "--exec", "--repo"].includes(flags[i - 1] ?? ""));
		const refspecs = positionals.slice(flags.some(arg => arg === "--repo" || arg.startsWith("--repo=")) ? 0 : 1);
		if (!refspecs.length) {
			if (isProtected(here.branch) || gitConfig(cwd, "push.default") === "matching") return INTEGRATION;
		} else if (refspecs.some(ref => {
			const into = ref.replace(/^\+/, "").split(":").at(-1);
			return ref === ":" || ref === "+:" || isProtected(into) || (into === "HEAD" && isProtected(here.branch));
		})) return INTEGRATION;
	} catch { /* No checkout at the command's working directory. */ }
}

function shellRefusal(source: string, start: string, worker?: string): string | undefined {
	let cwd = start;
	for (const argv of commands(source)) {
		while (argv[0] && (/^\w+=/.test(argv[0]) || /^(?:command|env|exec|sudo|nohup|time|!|if|then|elif|else|while|until|do|\{)$/.test(argv[0]))) argv.shift();
		const [path = "", ...args] = argv;
		const name = basename(path);
		if (name === "pkill" || name === "killall") return KILL;
		if (["bash", "sh"].includes(name) && /^-[a-z]*c[a-z]*$/.test(args[0] ?? "")) {
			const refusal = shellRefusal(args[1] ?? "", cwd, worker);
			if (refusal) return refusal;
		}
		if (worker) {
			if (argv.some(word => issuePath(word, cwd))) return TRACKER;
			const refusal = integration(name, args, cwd, worker);
			if (refusal) return refusal;
			if (name === "cd" && args[0]) cwd = shellPath(cwd, args[0]);
		}
	}
}

// Admit one standalone local setup command, with a literal path relative to the checkout root.
// An existing setting or custom default hook needs a human to decide how to preserve it.
function hookSetupRefusal(path: string, cwd: string): string | undefined {
	const unverified = `Cannot verify ${path} as a clean, shipped hook directory at the checkout root. Leave Git’s hook configuration unchanged.`;
	try {
		git(cwd, "config", "--get", "core.hooksPath");
		return "core.hooksPath is already configured. Leave it in place and commit normally.";
	} catch (error) {
		if ((error as { status?: number }).status !== 1) return unverified;
	}
	try {
		const root = realpathSync(cwd);
		if (root !== realpathSync(git(cwd, "rev-parse", "--show-toplevel"))) return unverified;
		const defaults = git(cwd, "rev-parse", "--path-format=absolute", "--git-path", "hooks");
		try {
			const existing = readdirSync(defaults).find(name => !name.endsWith(".sample"));
			if (existing) return `The default hooks directory contains ${existing}. Leave it in place and commit normally.`;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") return unverified;
		}
		const hook = `${path}/pre-commit`;
		if (!git(cwd, "ls-tree", "HEAD", "--", hook).startsWith("100755 blob ")) return unverified;
		const file = resolve(root, hook);
		if (realpathSync(file) !== file || !lstatSync(file).isFile()) return unverified;
		accessSync(file, constants.X_OK);
		if (git(cwd, "status", "--porcelain", "--ignored", "--untracked-files=all", "--", path)) return unverified;
	} catch { return unverified; }
}

/** The git hook bypasses a worker reaches for, in a shell command; the reason, or undefined. */
export function hookBypass(command: string): string | undefined {
	for (const segment of command.split(/&&|\|\||[;|\n]/)) {
		if (/(?:^|\s)-c\s*core\.hookspath=/i.test(segment) || /\bconfig\b.*\bcore\.hookspath\s+(?!-)\S/i.test(segment) && !/--(?:get|unset)/.test(segment)) return "core.hooksPath";
		if (/\bgit\b.*\s--no-verify\b/.test(segment)) return "--no-verify";
		// commit's -n is --no-verify, alone or among short flags (-an); -m/-F arguments are not flags.
		// Only inspect commit's suffix: an outer command (e.g. tmux -n) has its own flags.
		const commitArgs = segment.match(/\bgit\b.*?\bcommit\b(.*)/)?.[1];
		if (commitArgs && /\s-(?!-)[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(commitArgs.replace(/(-[a-zA-Z]*[mF])\s+("[^"]*"|'[^']*'|\S+)/g, "$1"))) return "commit -n";
		if (/\bHUSKY=0\b|\bHUSKY_SKIP_HOOKS=(?:1|true)\b/.test(segment)) return "HUSKY";
	}
}

export default function (pi: ExtensionAPI) {
	const worker = process.env.PI_WM_HANDLE;
	// One follow-up per input leaves a repeated failure visible rather than looping.
	let followedUp = false;
	pi.on("input", () => { followedUp = false; });
	pi.on("agent_end", (event, ctx) => {
		if (followedUp) return;
		const last = event.messages.at(-1);
		if (last?.role !== "assistant" || last.stopReason === "error" || last.stopReason === "aborted") return;
		const text = last.content.filter(part => part.type === "text").map(part => part.text).join("\n");
		let wake: string | undefined;
		if (PROMISED_WAKE.test(text)) {
			// Without a session file pi-processes keeps no receipt, so a live process is unknowable.
			const sessionFile = ctx.sessionManager.getSessionFile();
			if (sessionFile && managedProcess(sessionFile, true) === false) wake = NO_WAKE;
		}
		const report = worker ? parse(text, ctx.cwd) : undefined;
		const missing = report?.status === null;
		const handoff = missing ? statusRepairMessage(text, report.handoffError) : report?.status === "done" && report.handoffError?.startsWith("Foreign commits ") ? report.handoffError : undefined;
		if (!wake && !handoff) return;
		followedUp = true;
		const content = [wake, handoff].filter(Boolean).join("\n\n");
		pi.sendMessage({ customType: wake ? "promised-wake" : missing ? "status-handoff" : "commit-handoff", content, display: false }, { deliverAs: "followUp" });
	});
	pi.on("tool_call", (event, ctx) => {
		const input = event.input as { path?: unknown; command?: unknown; timeout?: unknown };
		const cwd = ctx?.cwd ?? process.cwd();
		if (worker && ["read", "grep"].includes(event.toolName) && typeof input.path === "string" &&
			[...commands(input.path)].flat().some(word => issuePath(word, cwd))) return { block: true, reason: TRACKER };
		if (event.toolName !== "bash" && event.toolName !== "process") return;
		// bash uses seconds; millisecond-shaped values have held workers for hours.
		if (event.toolName === "bash" && typeof input.timeout === "number" && input.timeout > 1800)
			return { block: true, reason: `bash timeout is in seconds: ${input.timeout} s is ${(input.timeout / 3600).toFixed(1)} h; the ceiling is 1800 s. Slow or streaming work goes through the process tool.` };
		const command = String(input.command ?? "");
		if (!command) return;
		const reason = shellRefusal(command, cwd, worker);
		if (reason) return { block: true, reason };
		const bypass = worker ? hookBypass(command) : undefined;
		if (bypass === "core.hooksPath") {
			const setup = /^git[ \t]+config[ \t]+--local[ \t]+([\w.]+)[ \t]+(\w[\w-]*(?:\/[\w-]+)*)$/.exec(command.trim());
			if (setup?.[1].toLowerCase() === "core.hookspath") {
				const reason = hookSetupRefusal(setup[2], cwd);
				return reason ? { block: true, reason } : undefined;
			}
		}
		if (bypass) return { block: true, reason: "Workers don't bypass git hooks (" + bypass + "): they are the project's own checks, and commits that skip them escaped its formatter. Commit normally. If a hook is slow, run the commit as a managed process and wait for it; if it fails for reasons outside your change, report blocked with its output." };
	});
}
