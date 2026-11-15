import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { bbThreads } from "./thread/bb";
import { git } from "./thread/git";
import { command, delay } from "./thread/process";

/** Shared convention files belong to the main checkout, even when called from a worktree. */
export function deskPath(cwd = process.cwd()): string {
	return join(dirname(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")), "desk");
}

function read(path: string): string {
	try { return readFileSync(path, "utf8"); }
	catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
}

const owner = (text: string) => text.match(/^Owner: @thread:([A-Za-z0-9_-]+)/m)?.[1]
	?? text.match(/@thread:([A-Za-z0-9_-]+)/)?.[1];
const line = (value: string, name: string) => {
	if (!value.trim() || /[\r\n]/.test(value)) throw new Error(name + " must be a nonempty single line");
	return value.trim();
};
const threadId = (value: string) => {
	value = value.replace(/^@thread:/, "");
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid bb thread id: " + value);
	return value;
};

/** The bb thread holding a role per desk/ROLES.md. The file is cleaned only on writes, so a caller checks the thread is still live. */
export function roleThread(role: string, cwd = process.cwd()): string | undefined {
	const prefix = "- role: " + line(role, "Role") + " — ";
	const row = read(join(deskPath(cwd), "ROLES.md")).split("\n").find(r => r.startsWith(prefix));
	return row ? owner(row) : undefined;
}

interface Files { roles: string[]; intro: string; items: string[] }
async function writeDesk(cwd: string, change: (files: Files, live: Set<string>) => void, keepOwner?: string): Promise<string> {
	const common = git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir");
	const dir = deskPath(cwd);
	const lock = join(common, "desk.lock");
	const deadline = Date.now() + 30_000;
	for (;;) {
		try { mkdirSync(lock); break; }
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			if (Date.now() >= deadline) throw new Error("Desk is locked: " + lock);
			await delay(50);
		}
	}
	try {
		// A failed bb lookup aborts the write rather than treating every owner as deleted.
		const live = new Set([...await bbThreads()].filter(([, t]) => !t.archivedAt).map(([id]) => id));
		const alive = (text: string) => { const id = owner(text); return !id || id === keepOwner || live.has(id); };
		const attention = read(join(dir, "ATTENTION.md")).split(/(?=^## )/m);
		const intro = attention[0]?.startsWith("## ") ? "" : attention.shift() ?? "";
		const files: Files = {
			roles: (read(join(dir, "ROLES.md")) || "# Roles\n").split("\n").filter(alive),
			intro: intro.trim() || "# Attention",
			items: attention,
		};
		change(files, live);
		// Questions remain open after their asking thread disappears. Only role rows expire.
		const pickup = JSON.parse(read(join(common, "pickup", "state.json")) || "null") as { enabled: boolean; owner: string } | null;
		const pickupOwner = pickup?.enabled && live.has(pickup.owner) ? pickup.owner : undefined;
		const supervisor = pickupOwner ?? owner(files.roles.find(row => row.startsWith("- role: supervisor — ") && live.has(owner(row) ?? "")) ?? "");
		files.items = files.items.map(item => {
			if (alive(item)) return item;
			const previous = owner(item)!;
			const ownership = "Owner: @thread:" + (supervisor ?? previous) + (supervisor ? "" : " (owner gone)");
			item = /^Owner:/m.test(item)
				? item.replace(/^Owner:.*$/m, ownership)
				: item.replace(/^(## .*\n)/, "$1\n" + ownership + "\n");
			return supervisor ? item.trimEnd() + "\n\nPrevious owner: @thread:" + previous + "\n" : item;
		});
		mkdirSync(dir, { recursive: true });
		const exclude = join(common, "info", "exclude");
		mkdirSync(dirname(exclude), { recursive: true });
		const excluded = read(exclude);
		if (!excluded.split(/\r?\n/).includes("/desk/"))
			writeFileSync(exclude, excluded + (excluded && !excluded.endsWith("\n") ? "\n" : "") + "/desk/\n");
		const roles = files.roles.join("\n").trim() || "# Roles";
		const items = files.items.map(item => item.trim()).filter(Boolean);
		for (const [name, content] of [
			["ROLES.md", roles + "\n"],
			["ATTENTION.md", [files.intro, ...items].join("\n\n") + "\n"],
		]) {
			const path = join(dir, name!);
			const temp = path + "." + process.pid + ".tmp";
			try { writeFileSync(temp, content!); renameSync(temp, path); }
			finally { rmSync(temp, { force: true }); }
		}
		return dir;
	} finally { rmSync(lock, { recursive: true }); }
}

function requireLive(live: Set<string>, thread: string) {
	if (!live.has(thread)) throw new Error("No live bb thread: " + thread);
}

export function setRole(role: string, thread: string, cwd = process.cwd()) {
	role = line(role, "Role"); thread = threadId(thread);
	return writeDesk(cwd, (files, live) => {
		requireLive(live, thread);
		const prefix = "- role: " + role + " — ";
		files.roles = files.roles.filter(row => !row.startsWith(prefix));
		files.roles.push(prefix + "@thread:" + thread);
	});
}
export function clearRole(role: string, thread: string, cwd = process.cwd()) {
	role = line(role, "Role"); thread = threadId(thread);
	return writeDesk(cwd, files => {
		files.roles = files.roles.filter(row => !(row.startsWith("- role: " + role + " — ") && owner(row) === thread));
	});
}
export function setWorking(thread: string, text: string, cwd = process.cwd()) {
	thread = threadId(thread); text = line(text, "Working on");
	return writeDesk(cwd, (files, live) => {
		requireLive(live, thread);
		files.roles = files.roles.filter(row => !(row.startsWith("- working: ") && owner(row) === thread));
		files.roles.push("- working: @thread:" + thread + " — " + text);
	});
}
export function clearWorking(thread: string, cwd = process.cwd()) {
	thread = threadId(thread);
	return writeDesk(cwd, files => {
		files.roles = files.roles.filter(row => !(row.startsWith("- working: ") && owner(row) === thread));
	});
}
const itemTitle = (item: string) => item.split("\n")[0]?.slice(3).trim();
export interface AttentionCredentials {
	writeEnv: string;
	secrets: { name: string; description: string }[];
}
export async function addAttention(thread: string, title: string, body: string, cwd = process.cwd(), credentials?: AttentionCredentials) {
	thread = threadId(thread); title = line(title, "Title");
	if (/^## /m.test(body)) throw new Error("An attention item has one ## heading; use ### within its body");
	if (/^Owner:/m.test(body)) throw new Error("Owner is supplied by the helper");
	const secretLines: string[] = [];
	if (credentials) {
		const path = line(credentials.writeEnv, "Write-env path");
		if (!isAbsolute(path)) throw new Error("--write-env must be an absolute path");
		if (!credentials.secrets.length) throw new Error("--write-env requires --secret NAME=DESCRIPTION");
		const names = new Set<string>();
		for (const { name, description } of credentials.secrets) {
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid secret variable name: " + name);
			if (names.has(name)) throw new Error("Duplicate secret variable: " + name);
			names.add(name);
			secretLines.push("Secret: " + name + " → " + path + ": " + line(description, "Secret description"));
		}
	}
	const item = "## " + title + "\n\n" + ["Owner: @thread:" + thread, ...secretLines].join("\n") + "\n\n" + body.trim();
	let changed = false;
	const dir = await writeDesk(cwd, (files, live) => {
		requireLive(live, thread);
		const previous = files.items.find(item => owner(item) === thread && itemTitle(item) === title);
		changed = previous?.trim() !== item;
		files.items = files.items.filter(item => !(owner(item) === thread && itemTitle(item) === title));
		files.items.push(item);
	});
	if (changed) {
		try {
			const result = JSON.parse(await command(process.env.BB_CLI || "bb", [
				"push-notifications", "send",
				"--title", basename(dirname(dir)) + ": " + title,
				"--body", body.trim().split(/\r?\n[ \t]*\r?\n/)[0]!.replace(/\r?\n/g, " "),
				"--thread", thread, "--json",
			], cwd));
			if (result.ok === false || !result.channels?.length)
				throw new Error(result.error?.message ?? "No notification channel reached");
		} catch (error) {
			console.error("Desk notification failed: " + String(error instanceof Error ? error.message : error).replace(/[\r\n]+/g, " "));
		}
	}
	return dir;
}
export function removeAttention(thread: string, title: string, cwd = process.cwd()) {
	thread = threadId(thread); title = line(title, "Title");
	return writeDesk(cwd, files => {
		files.items = files.items.filter(item => !(owner(item) === thread && itemTitle(item) === title));
	});
}
/** Move desk ownership before the source thread is archived. Retain its rows on a retry too. */
export async function handoverDesk(from: string, to: string, cwd = process.cwd()) {
	let roles = 0, attention = 0;
	await writeDesk(cwd, (files, live) => {
		requireLive(live, to);
		files.roles = [...new Set(files.roles.map(row => {
			if (owner(row) !== from) return row;
			roles++;
			return row.replace("@thread:" + from, "@thread:" + to);
		}))];
		const working = files.roles.filter(row => row.startsWith("- working: ") && owner(row) === to);
		if (working.length > 1) {
			files.roles = files.roles.filter(row => !working.includes(row));
			files.roles.push("- working: @thread:" + to + " — " + working.map(row => row.split(" — ").slice(1).join(" — ")).join("; "));
		}
		files.items = files.items.map(item => {
			if (owner(item) !== from) return item;
			attention++;
			return item.replace("@thread:" + from, "@thread:" + to)
				.replace(/^(Owner: @thread:[A-Za-z0-9_-]+) \(owner gone\)$/m, "$1");
		});
	}, from);
	return { roles, attention };
}
export const cleanDesk = (cwd = process.cwd()) => writeDesk(cwd, () => {});

const usage = [
	"desk path | clean",
	"desk handover OLD NEW",
	"desk role set|clear ROLE [--thread ID]",
	"desk working set TEXT|clear [--thread ID]",
	"desk attention add TITLE --file PATH|- [--secret NAME=DESCRIPTION ... --write-env /absolute/path] [--thread ID]",
	"desk attention remove TITLE [--thread ID]",
	"Thread defaults to BB_THREAD_ID. All writes clean both files.",
].join("\n");

async function main(argv: string[]) {
	const take = (flag: string) => {
		const at = argv.indexOf(flag);
		if (at < 0) return undefined;
		if (!argv[at + 1]) throw new Error("Missing value for " + flag);
		return argv.splice(at, 2)[1];
	};
	const thread = take("--thread") ?? process.env.BB_THREAD_ID;
	const file = take("--file");
	const writeEnv = take("--write-env");
	const secrets: AttentionCredentials["secrets"] = [];
	while (argv.includes("--secret")) {
		const secret = take("--secret")!;
		const at = secret.indexOf("=");
		if (at < 1) throw new Error("--secret must be NAME=DESCRIPTION");
		secrets.push({ name: secret.slice(0, at), description: secret.slice(at + 1) });
	}
	if (secrets.length && !writeEnv) throw new Error("--secret requires --write-env /absolute/path");
	const credentials = writeEnv === undefined ? undefined : { writeEnv, secrets };
	const [group, action, value, ...extra] = argv;
	if (credentials && (group !== "attention" || action !== "add")) throw new Error("Secret options require attention add");
	if (extra.length) throw new Error(usage);
	if (group === "--help" || group === "-h" || !group) return console.log(usage);
	if (group === "path" && !action) return console.log(deskPath());
	if (group === "clean" && !action) return console.log(await cleanDesk());
	if (group === "handover" && action && value) {
		const { handover } = await import("./handover");
		return console.log(JSON.stringify(await handover(threadId(action), threadId(value)), null, 2));
	}
	if (!thread) throw new Error("Supply --thread ID or BB_THREAD_ID");
	let result: string;
	if (group === "role" && value && action === "set") result = await setRole(value, thread);
	else if (group === "role" && value && action === "clear") result = await clearRole(value, thread);
	else if (group === "working" && value && action === "set") result = await setWorking(thread, value);
	else if (group === "working" && !value && action === "clear") result = await clearWorking(thread);
	else if (group === "attention" && value && action === "add" && file)
		result = await addAttention(thread, value, file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8"), process.cwd(), credentials);
	else if (group === "attention" && value && action === "remove") result = await removeAttention(thread, value);
	else throw new Error(usage);
	console.log(result);
}
if (import.meta.main) main(process.argv.slice(2)).catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
