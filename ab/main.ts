#!/usr/bin/env bun
// ab: the exec kernel's library surface as a shell program. Each subcommand is a thin
// adapter over lib/ and the exec source engine; scoped help lives in ab/help/<command>.md.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { exact, OPEN, CLOSE, inTool } from "../lib/raw.ts";

const HERE = dirname(new URL(import.meta.url).pathname);
const ROOT = resolve(HERE, "..");
const cwd = process.cwd();
const abStateRoot = process.env.AB_STATE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "ab");
const stateDir = process.env.AB_SESSION_STATE ?? process.env.AB_STATE ?? join(abStateRoot, createHash("sha1").update(cwd).digest("hex").slice(0, 12));
const COMMANDS = ["read", "grep", "edit", "raw", "view", "skill", "code", "computer", "pull", "lib", "daemon", "job", "supervise", "tree", "mail"];

function help(command?: string): string {
	const file = join(HERE, "help", (command ?? "index") + ".md");
	if (!existsSync(file)) throw new Error("no help for " + command + "; commands: " + COMMANDS.join(", "));
	return readFileSync(file, "utf8");
}
function fail(message: string): never { process.stderr.write("ab: " + message + "\n"); process.exit(2); }

/** Side channel to the harness: attachments such as images, one JSON object per line. */
function attach(event: Record<string, unknown>): boolean {
	const out = process.env.AB_OUT;
	if (!out) return false;
	appendFileSync(out, JSON.stringify(event) + "\n");
	return true;
}

async function source() {
	const [{ createSourceAPI }, { Ledger }] = await Promise.all([import("../extensions/exec/source.ts"), import("../lib/outline-read/ledger.ts")]);
	mkdirSync(stateDir, { recursive: true });
	const file = join(stateDir, "ledger.jsonl");
	const ledger = new Ledger();
	if (existsSync(file)) for (const line of readFileSync(file, "utf8").split("\n")) if (line) ledger.restore(JSON.parse(line));
	return createSourceAPI({ cwd, ledger, persist(path: string) { const entry = ledger.entry(path); if (entry) appendFileSync(file, JSON.stringify(entry) + "\n"); } });
}

const OUTLINE_OVER = Number(process.env.AB_OUTLINE_OVER) || 300;
/** path, path:50-80, path:50+30, path:50-, path:all, path:outline; several ranges with commas. */
function selector(arg: string): { path: string; spec?: string } {
	const m = /^(.*?):((?:\d+(?:-\d*|\+\d+)?)(?:,\d+(?:-\d*|\+\d+)?)*|all|outline)$/.exec(arg);
	return m && !existsSync(arg) ? { path: m[1], spec: m[2] } : { path: arg };
}

async function read(args: string[]) {
	if (!args.length) fail("read needs a path");
	const api = await source();
	const out: string[] = [];
	for (const arg of args) {
		const { path, spec } = selector(arg);
		const file: any = await api.read(path);
		if (!file.rows) {
			out.push(attach({ type: "image", path: resolve(cwd, path) }) ? "[image attached: " + path + "]" : "[image: " + path + "; run inside the ab-aware bash tool to attach it]");
			continue;
		}
		const lines = file.rows.length;
		if (spec === "all" || (!spec && lines <= OUTLINE_OVER)) out.push(file.render());
		else if (!spec || spec === "outline") out.push((await file.outline()).render() + "\n[" + lines + " lines; ab read " + path + ":START-END for ranges, :all for everything]");
		else {
			const rows: any[] = [];
			for (const part of spec.split(",")) {
				const [, a, op, b] = /^(\d+)([-+]?)(\d*)$/.exec(part)!;
				const start = Number(a);
				const end = op === "+" ? start + Number(b) - 1 : op === "-" ? (b ? Number(b) : lines) : start;
				rows.push(...file.lines(start, Math.min(Math.max(start, end), lines)).rows);
			}
			out.push(file.lines(1, lines).filter((row: any) => rows.includes(row)).render());
		}
	}
	console.log(out.join("\n\n"));
}

async function grep(args: string[]) {
	const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
		"ignore-case": { type: "boolean", short: "i" }, "line-number": { type: "boolean", short: "n" }, fixed: { type: "boolean", short: "F" },
		glob: { type: "string", short: "g" }, limit: { type: "string", short: "m" }, context: { type: "string", short: "C" },
	} });
	const [pattern, ...paths] = positionals;
	if (!pattern) fail("grep needs a pattern");
	const api = await source();
	let hits: any = await api.grep(pattern, paths.length ? paths : undefined, { ignoreCase: values["ignore-case"], literal: values.fixed, glob: values.glob, limit: values.limit ? Number(values.limit) : undefined });
	if (values.context) hits = hits.context(Number(values.context));
	console.log(hits.render());
	if (!hits.rows.length) process.exitCode = 1;
}

async function edit(args: string[]) {
	// Hunks always come from stdin; an optional path asserts which file bare headers target.
	let input = readFileSync(0, "utf8");
	if (!input.trim()) fail("edit reads hunks from stdin: ab edit [PATH] <<'EOF' … EOF; see ab edit --help");
	if (args[0]) {
		const lines = input.split("\n");
		input = lines.map((line, i) => (i === 0 || lines[i - 1] === "") && /^[=<>-][0-9a-z]{4}( [0-9a-z]{4})?$/.test(line) ? line + " @" + args[0] : line).join("\n");
	}
	const api = await source();
	console.log((await api.edit(input)).text);
}

async function view(args: string[]) {
	if (!args.length) fail("view needs an image path");
	for (const path of args) {
		if (!existsSync(path)) fail(path + ": no such file");
		console.log(attach({ type: "image", path: resolve(cwd, path) }) ? "[image attached: " + path + "]" : "[AB_OUT unset: images attach only inside the ab-aware bash tool]");
	}
}

async function skill(args: string[]) {
	if (!args[0]) fail("skill needs a SKILL.md path or directory");
	const { createSkillLoader } = await import("../extensions/exec/skill-loader.cjs");
	const runShell = async (command: string, options: any) => {
		const r = spawnSync("bash", ["-c", command], { ...options, encoding: "utf8", maxBuffer: 1 << 20 });
		return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.status, stdoutTruncated: false, stderrTruncated: false };
	};
	const loaded = await createSkillLoader(cwd, runShell, (v: unknown) => v)(args[0]);
	console.log(loaded.text);
}

async function code(args: string[]) {
	const [verb, ...rest] = args;
	const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, allowNegative: true, options: {
		file: { type: "string", short: "f" }, kind: { type: "string", short: "k", multiple: true }, exported: { type: "boolean" },
		root: { type: "string" }, tsconfig: { type: "string" }, hops: { type: "string" }, by: { type: "string" }, n: { type: "string" }, body: { type: "boolean" },
	} });
	const code = await import("../lib/code.ts");
	const index = code.index(values.root ?? cwd, values.tsconfig ?? "tsconfig.json");
	const loc = (d: any) => d.file + ":" + d.line + "-" + d.endLine;
	const line = (d: any) => loc(d) + "  " + d.kind + " " + (d.parent ? d.parent + "." : "") + d.name + "  " + d.signature.split("\n")[0].slice(0, 160);
	const pattern = (p?: string) => p && /^\/.*\/$/.test(p) ? new RegExp(p.slice(1, -1)) : p;
	const one = () => { if (!positionals[0]) fail(verb + " needs a definition name"); return index.def(pattern(positionals[0])!, pattern(values.file)); };
	switch (verb) {
		case undefined: case "stats": console.log(index.render()); break;
		case "defs": for (const d of index.defs({ name: pattern(positionals[0]), file: pattern(values.file), kind: values.kind as any, exported: values.exported })) console.log(line(d)); break;
		case "def": { const d = one(); console.log(line(d)); if (values.body !== false) console.log(d.body); break; }
		case "callers": case "callees": for (const e of index[verb](one())) console.log(e.kind.padEnd(6) + " " + line(e.def)); break;
		case "tests": case "impact": for (const d of index[verb](one())) console.log(line(d)); break;
		case "dead": for (const d of index.dead()) console.log(line(d)); break;
		case "similar": for (const s of index.similar(one(), { by: values.by as any, n: values.n ? Number(values.n) : undefined })) console.log(s.score.toFixed(2) + " " + line(s.def)); break;
		case "around": console.log(index.around(one(), { hops: values.hops ? Number(values.hops) : undefined })); break;
		case "rows": { const d = one(); const api = await source(); console.log((await api.read(d.path) as any).lines(d.line, d.endLine).render()); break; }
		default: fail("unknown code verb " + verb + "; see ab code --help");
	}
}

async function daemon(args: string[]) {
	const api = await import("../lib/daemon.ts");
	const verb = args[0] ?? "status";
	if (verb === "status" && args.length <= 1) {
		const jobs = await api.status();
		if (!jobs.length) console.log("no jobs");
		else for (const item of jobs) console.log(JSON.stringify(item));
		return;
	}
	if (verb === "stop" && args.length === 2) {
		console.log(JSON.stringify(await api.stop(args[1])));
		return;
	}
	if (verb === "shutdown" && args.length === 1) {
		await api.shutdown();
		console.log("daemon stopped");
		return;
	}
	fail("usage: ab daemon [status|stop <id>|shutdown]");
}

async function job(args: string[]) {
	if (args[0] !== "start" || !args[1] || args.length < 3) fail("usage: ab job start <type> <json>");
	let input: unknown;
	try { input = JSON.parse(args.slice(2).join(" ")); }
	catch (error) { fail("job input must be JSON: " + String(error)); }
	const result = await import("../lib/daemon.ts").then(api => api.start(args[1], input));
	console.log(JSON.stringify(result));
}

// Supervision loop (lib/jobs/supervise.ts) run by the daemon for the owning agent. State and
// the owner's resume commands live under the checkout's git dir, keyed by ticket.
// Session views over lib/tree: every pi session with its parent, project and live state.
async function tree(args: string[]) {
	if (args[0] === "sidebar") return (await import("../lib/tree/ghostty.ts")).openSidebar();
	if (args[0] === "ui") return (await import("../lib/tree/ui.ts")).ui({ sidebar: args.includes("--sidebar"), query: args.slice(1).filter(a => a !== "--sidebar").join(" ") });
	if (args[0] === "open" || args[0] === "park" || args[0] === "send") {
		const { graph } = await import("../lib/tree/graph.ts");
		const act = await import("../lib/tree/actions.ts");
		const node = [...(await graph()).values()].find(n => n.id === args[1] || n.id.startsWith(args[1] ?? "\0"));
		if (!node) fail("no session " + args[1]);
		const text = args[0] === "send" ? (args.slice(2).join(" ") || await Bun.stdin.text()) : "";
		const message = args[0] === "open" ? act.open(node) : args[0] === "park" ? act.park(node) : act.send(node, text);
		if (message) fail(message);
		return;
	}
	const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
		mode: { type: "string", short: "m", default: "tree" }, all: { type: "boolean", short: "a" },
		json: { type: "boolean" }, days: { type: "string" }, hours: { type: "string" } } });
	const { graph } = await import("../lib/tree/graph.ts");
	const view = await import("../lib/tree/view.ts");
	const nodes = await graph({ days: values.days ? Number(values.days) : undefined });
	const mode = values.mode as "tree" | "projects" | "status";
	if (!["tree", "projects", "status"].includes(mode)) fail("mode must be tree, projects or status");
	const rows = view.rows(nodes, mode, { query: positionals.join(" "), all: values.all, hours: values.hours ? Number(values.hours) : undefined });
	if (values.json) for (const r of rows) console.log(JSON.stringify(r.kind === "header" ? r : { ...r, node: { ...r.node, children: undefined, lastText: undefined } }));
	else for (const r of rows) console.log(view.line(r));
}

async function supervise(args: string[]) {
	const api = await import("../lib/daemon.ts");
	const [verb, given, ...rest] = args;
	// An issue is named by its slug; a path to its file (docs/issues/<slug>.md) names the same issue.
	const ticket = given && /\.md$/.test(given) ? basename(given, ".md") : given;
	const gitDir = spawnSync("git", ["rev-parse", "--absolute-git-dir"], { cwd, encoding: "utf8" }).stdout.trim();
	const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).stdout.trim();
	if (!gitDir || !top) fail("supervise runs in the owner's checkout");
	const dir = join(gitDir, "ab-supervise");
	const jobs = (await api.status()).filter(j => j.type === "supervise" && (j.input as any).cwd === top && (!ticket || (j.input as any).ticket === ticket));
	if (verb === "start" && ticket) {
		const { values } = parseArgs({ args: rest, options: { budget: { type: "string" }, test: { type: "string" } } });
		const session = process.env.PI_SESSION_ID;
		if (!session) fail("supervise start runs from the owning pi session (PI_SESSION_ID): it is woken in its mailbox");
		const owner = (await import("../lib/board/mailbox.ts")).mailbox(session);
		// One loop per ticket per repository: loops started from sibling worktrees would dispatch the same children twice.
		const common = (dir: string) => { const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: dir, encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : dir; };
		const here = common(top);
		const elsewhere = (await api.status()).find(j => j.type === "supervise" && j.status === "running" && (j.input as any).ticket === ticket && existsSync((j.input as any).cwd) && common((j.input as any).cwd) === here);
		if (elsewhere) fail("already supervising " + ticket + " (" + elsewhere.id + ", owner " + (elsewhere.input as any).owner + ", checkout " + (elsewhere.input as any).cwd + "); ab supervise status " + ticket + " there");
		const previous = jobs.at(-1);
		mkdirSync(dir, { recursive: true });
		const id = "supervise-" + ticket.replace(/[^A-Za-z0-9_-]/g, "-") + "-" + Date.now().toString(36);
		const input = { ticket, cwd: top, owner, ownerSession: session, budget: Number(values.budget ?? 3), test: values.test, commands: join(dir, ticket + ".commands.jsonl"), carried: previous?.state ?? null };
		const record = await api.start("supervise", input, { id, stateFile: join(dir, id + ".json") });
		console.log(record.id + " " + record.status + (previous ? " (continuing " + previous.id + ")" : ""));
		return;
	}
	if (verb === "status" || !verb) {
		if (!jobs.length) return console.log("no supervision jobs here");
		for (const j of jobs) {
			const s = j.state as any;
			console.log(j.id + " " + j.status + (j.error ? " " + j.error : "") + (s ? " " + JSON.stringify(s.metrics) + " integrated: " + (s.integrated.join(", ") || "-") : ""));
			for (const c of Object.values<any>(s?.children ?? {})) console.log("  " + c.slug + " " + c.phase + " " + (c.handle.run + "/" + c.handle.handle) + (c.waiting ? " waiting: " + c.waiting : ""));
		}
		return;
	}
	if (verb === "resume" && ticket && rest.length === 2 && ["verify", "integrate", "drop", "redispatch"].includes(rest[1])) {
		const running = jobs.find(j => j.status === "running");
		if (!running) fail("no running supervision of " + ticket + "; ab supervise start " + ticket + " continues from its state");
		appendFileSync((running.input as any).commands, JSON.stringify({ child: rest[0], action: rest[1] }) + "\n");
		console.log("queued " + rest[1] + " " + rest[0]);
		return;
	}
	if (verb === "stop" && ticket) { for (const j of jobs.filter(j => j.status === "running")) console.log(JSON.stringify((await api.stop(j.id)).status)); return; }
	fail("usage: ab supervise start <ticket> [--budget N] [--test CMD] | status [ticket] | resume <ticket> <child> verify|integrate|drop|redispatch | stop <ticket>");
}


function pull(args: string[]) {
	for (const id of args) {
		const file = join(stateDir, "ingress", id);
		if (!existsSync(file)) fail("unknown page " + id + " (pages are kept per session in $AB_SESSION_STATE/ingress)");
		process.stdout.write(exact(readFileSync(file, "utf8")));
	}
}

/** Exact output: `CMD | ab raw`, or `ab raw CMD ARG...` to include stderr and keep the exit status. */
function raw(args: string[]) {
	if (!args.length) return void process.stdout.write(exact(readFileSync(0, "utf8")));
	if (inTool()) process.stdout.write(OPEN);
	const r = spawnSync(args[0], args.slice(1), { stdio: ["inherit", "inherit", "inherit"] });
	if (inTool()) process.stdout.write(CLOSE);
	if (r.error) fail(r.error.message);
	process.exitCode = r.status ?? 1;
}

async function lib(args: string[]) {
	const [module, fn, ...rest] = args;
	if (!module) fail("lib needs a module name; ls " + join(ROOT, "lib"));
	const loaded: any = await import(join(ROOT, "lib", module + ".ts"));
	if (!fn) return console.log(Object.keys(loaded).map(k => k + (typeof loaded[k] === "function" ? "(" + loaded[k].length + ")" : "")).join("\n"));
	const target = fn.split(".").reduce((o: any, k) => o?.[k], loaded);
	if (typeof target !== "function") fail(module + "." + fn + " is not a function");
	const parsed = rest.map(a => { try { return JSON.parse(a); } catch { return a; } });
	const result = await target(...parsed);
	if (result === undefined) return;
	console.log(typeof result === "string" ? result : typeof result?.render === "function" ? result.render() : JSON.stringify(result, null, 2));
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === "--help" || command === "-h" || command === "help") { console.log(help(command === "help" ? args[0] : undefined)); process.exit(0); }
if (args.includes("--help") || args.includes("-h")) { console.log(help(command)); process.exit(0); }
const run: Record<string, (a: string[]) => unknown> = { read, grep, edit, raw, view, skill, code, tree, computer: (a: string[]) => import("./computer.ts").then(c => c.computer(a, stateDir, fail)), pull, lib, daemon, job, supervise,
	mail: async (a: string[]) => {
		if (a[0] === "--stats") {
			// How the channels get used: posts and distinct senders per kind (mail, wt, ticket).
			const { readAll } = await import("../lib/board/store.ts");
			const kinds = new Map<string, { posts: number; topics: Set<string>; senders: Set<string> }>();
			for (const m of readAll()) {
				const kind = m.topic.split("/")[0]!;
				if (!["mail", "wt", "ticket"].includes(kind)) continue;
				const k = kinds.get(kind) ?? { posts: 0, topics: new Set(), senders: new Set() };
				k.posts++; k.topics.add(m.topic); k.senders.add(m.from.session ?? m.from.name ?? "?");
				kinds.set(kind, k);
			}
			for (const [kind, k] of kinds) console.log(`${kind}\t${k.posts} posts\t${k.topics.size} topics\t${k.senders.size} senders`);
			return;
		}
		const [to, ...words] = a;
		const body = words.length ? words.join(" ") : (await Bun.stdin.text()).trimEnd();
		if (!to || !body) fail("usage: ab mail <mailbox> <text...>   (or text on stdin)");
		const m = (await import("../lib/board/mailbox.ts")).mail(to, body);
		console.log(m.topic + " " + m.id);
	} };
if (!run[command]) fail("unknown command " + command + "; commands: " + COMMANDS.join(", "));
try { await run[command](args); }
catch (error) { fail(error instanceof Error ? error.message : String(error)); }
