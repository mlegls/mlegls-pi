import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bbThreads } from "./thread/bb";
import { git } from "./thread/git";
import { delay } from "./thread/process";

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

interface Files { roles: string[]; intro: string; items: string[] }
async function writeDesk(cwd: string, change: (files: Files, live: Set<string>) => void): Promise<string> {
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
		const alive = (text: string) => { const id = owner(text); return !id || live.has(id); };
		const attention = read(join(dir, "ATTENTION.md")).split(/(?=^## )/m);
		const intro = attention[0]?.startsWith("## ") ? "" : attention.shift() ?? "";
		const files: Files = {
			roles: (read(join(dir, "ROLES.md")) || "# Roles\n").split("\n").filter(alive),
			intro: intro.trim() || "# Attention",
			items: attention.filter(alive),
		};
		change(files, live);
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
export function addAttention(thread: string, title: string, body: string, cwd = process.cwd()) {
	thread = threadId(thread); title = line(title, "Title");
	if (/^## /m.test(body)) throw new Error("An attention item has one ## heading; use ### within its body");
	if (/^Owner:/m.test(body)) throw new Error("Owner is supplied by the helper");
	return writeDesk(cwd, (files, live) => {
		requireLive(live, thread);
		files.items = files.items.filter(item => !(owner(item) === thread && itemTitle(item) === title));
		files.items.push("## " + title + "\n\nOwner: @thread:" + thread + "\n\n" + body.trim());
	});
}
export function removeAttention(thread: string, title: string, cwd = process.cwd()) {
	thread = threadId(thread); title = line(title, "Title");
	return writeDesk(cwd, files => {
		files.items = files.items.filter(item => !(owner(item) === thread && itemTitle(item) === title));
	});
}
export const cleanDesk = (cwd = process.cwd()) => writeDesk(cwd, () => {});

const usage = [
	"desk path | clean",
	"desk role set|clear ROLE [--thread ID]",
	"desk working set TEXT|clear [--thread ID]",
	"desk attention add TITLE --file PATH|- [--thread ID]",
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
	const [group, action, value, ...extra] = argv;
	if (extra.length) throw new Error(usage);
	if (group === "--help" || group === "-h" || !group) return console.log(usage);
	if (group === "path" && !action) return console.log(deskPath());
	if (group === "clean" && !action) return console.log(await cleanDesk());
	if (!thread) throw new Error("Supply --thread ID or BB_THREAD_ID");
	let result: string;
	if (group === "role" && value && action === "set") result = await setRole(value, thread);
	else if (group === "role" && value && action === "clear") result = await clearRole(value, thread);
	else if (group === "working" && value && action === "set") result = await setWorking(thread, value);
	else if (group === "working" && !value && action === "clear") result = await clearWorking(thread);
	else if (group === "attention" && value && action === "add" && file)
		result = await addAttention(thread, value, file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8"));
	else if (group === "attention" && value && action === "remove") result = await removeAttention(thread, value);
	else throw new Error(usage);
	console.log(result);
}
if (import.meta.main) main(process.argv.slice(2)).catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
