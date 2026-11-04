import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir, hostname } from "node:os";
import { dirname, isAbsolute, join, resolve, win32 } from "node:path";
import required from "./doctor.required.json";
import { getTracker, type Tracker } from "./tracker.ts";
import { doctorDirectory } from "./doctor-start.ts";

export interface Gap { kind: string; name: string; message: string; remedy: string }
export interface DoctorOptions {
	settings?: string;
	home?: string;
	which?: (name: string) => boolean;
	run?: (command: string[]) => Promise<{ ok: boolean; stdout: string }>;
	/** Names of non-empty secrets at env+path in the shared Infisical project; empty when this host has no access. */
	infisical?: (env: string, path: string) => Promise<Set<string>>;
	/** agent-prompts directory whose generated/ renders are checked; defaults to this checkout's when home is not overridden. */
	prompts?: string;
}

async function command(command: string[]) {
	try {
		const child = Bun.spawn(command, { stdout: "pipe", stderr: "ignore", timeout: 15_000 });
		// Consume output concurrently so a full pipe cannot block exit.
		const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
		return { ok: code === 0, stdout };
	} catch { return { ok: false, stdout: "" }; }
}

const parseEnvFile = (text: string) => new Map(text.split(/\r?\n/).flatMap(line => {
	const [, key, value] = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/) ?? [];
	return key === undefined || value === undefined ? [] : [[key, value.trim().replace(/^(['"])(.*)\1$/, "$2")] as [string, string]];
}));

/** Lists secret names only; values arrive in the response and are dropped here. Any failure means no access. */
function infisicalNames(home: string) {
	let token: Promise<string | undefined> | undefined;
	const login = async () => {
		if (process.env.INFISICAL_TOKEN) return process.env.INFISICAL_TOKEN;
		const file = required.infisical.identity.replace(/^~(?=\/)/, home);
		if (!existsSync(file)) return undefined;
		const agent = parseEnvFile(readFileSync(file, "utf8"));
		const res = await fetch(required.infisical.api + "/v1/auth/universal-auth/login", {
			method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15_000),
			body: JSON.stringify({ clientId: agent.get("INFISICAL_CLIENT_ID"), clientSecret: agent.get("INFISICAL_CLIENT_SECRET") }),
		});
		return res.ok ? ((await res.json()) as { accessToken?: string }).accessToken : undefined;
	};
	return async (env: string, path: string) => {
		try {
			const bearer = await (token ??= login());
			if (!bearer) return new Set<string>();
			const query = new URLSearchParams({ workspaceId: required.infisical.project, environment: env, secretPath: path });
			const res = await fetch(required.infisical.api + "/v3/secrets/raw?" + query, { headers: { Authorization: "Bearer " + bearer }, signal: AbortSignal.timeout(15_000) });
			if (!res.ok) return new Set<string>();
			const body = (await res.json()) as { secrets?: { secretKey: string; secretValue: string }[] };
			return new Set((body.secrets ?? []).filter(s => s.secretValue).map(s => s.secretKey));
		} catch { return new Set<string>(); }
	};
}

export async function diagnose(options: DoctorOptions = {}): Promise<Gap[]> {
	const home = options.home ?? homedir();
	const settings = options.settings ?? join(process.env.PI_CODING_AGENT_DIR ?? join(home, ".pi/agent"), "settings.json");
	const which = options.which ?? (name => Boolean(Bun.which(name)));
	const run = options.run ?? command;
	const infisical = options.infisical ?? infisicalNames(home);
	const gaps: Gap[] = [];
	const add = (kind: string, name: string, message: string, remedy: string) =>
		gaps.push({ kind, name, message, remedy });
	const expand = (path: string) => path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path;
	let data: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(readFileSync(settings, "utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
		data = parsed;
	}
	catch {
		add("settings", "settings.json", "pi settings are missing or invalid: " + settings, "Restore a valid pi settings.json on this host.");
	}
	const packagePaths = new Set<string>();
	for (const entry of Array.isArray(data.packages) ? data.packages : []) {
		const source = typeof entry === "string" ? entry : entry?.source;
		if (typeof source !== "string" || /^(npm:|git:|https?:|ssh:|git@)/.test(source)) continue;
		const path = resolve(dirname(settings), expand(source));
		packagePaths.add(path);
		if (!existsSync(path)) add("package", source, "missing pi package: " + source, "Install or restore the configured local pi package, then reload pi.");
	}
	const walk = (value: unknown, key: string) => {
		if (typeof value === "string") {
			if ((isAbsolute(value) || win32.isAbsolute(value) || value.startsWith("~/")) &&
				!packagePaths.has(resolve(dirname(settings), expand(value))) && !existsSync(expand(value)))
				add("path", key, "missing settings path: " + key + " (" + value + ")", "Correct this settings path for this host or restore its target.");
		} else if (Array.isArray(value)) value.forEach((v, i) => walk(v, key + "[" + i + "]"));
		else if (value && typeof value === "object")
			for (const [k, v] of Object.entries(value)) walk(v, key ? key + "." + k : k);
	};
	walk(data, "");
	// agents-apply.sh renders universal.md + <agent>.md into generated/; harness prompts link there, so an unrendered edit never reaches agents.
	const prompts = options.prompts ?? (options.home ? undefined : resolve(import.meta.dir, "../agent-prompts"));
	if (prompts && existsSync(join(prompts, "universal.md")) && existsSync(join(prompts, "generated"))) {
		const universal = readFileSync(join(prompts, "universal.md"), "utf8");
		for (const agent of readdirSync(join(prompts, "generated"))) {
			const addendum = join(prompts, agent + ".md");
			const expected = universal + (existsSync(addendum) ? "\n" + readFileSync(addendum, "utf8") : "");
			for (const file of readdirSync(join(prompts, "generated", agent)))
				if (readFileSync(join(prompts, "generated", agent, file), "utf8") !== expected)
					add("prompt", agent + "/" + file, "stale rendered agent prompt: " + agent + "/" + file, "Run ~/.config/system-config/scripts/agents-apply.sh --link.");
		}
	}
	for (const cli of required.clis)
		if (!which(cli)) add("cli", cli, "missing CLI: " + cli, "Install " + cli + " and expose it on the pi host's PATH.");

	// bb's list API exposes names/metadata, not credential values. Never echo its output.
	const env = await run(["bb", "machine", "env", "list", "--json"]);
	let keys = new Set<string>();
	try {
		if (!env.ok) throw new Error();
		const parsed = JSON.parse(env.stdout);
		if (!Array.isArray(parsed.variables) || !Array.isArray(parsed.inheritedVariables)) throw new Error();
		keys = new Set([...parsed.variables, ...parsed.inheritedVariables].map(v => v.name));
	} catch {
		add("env", "bb-env", "cannot check bb env key names", "Make bb machine env list available and authenticated on this host.");
	}
	for (const credential of required.credentials) {
		if (credential.keys.some(key => keys.has(key))) continue;
		const shared = "infisical" in credential ? credential.infisical : undefined;
		if (shared) {
			const names = await infisical(shared.env, shared.path);
			if (credential.keys.some(key => names.has(key))) continue;
		}
		const result = await run(credential.command);
		const authenticated = result.ok && (!("authenticatedUser" in credential) ||
			/^\s*(?:[-*]\s*)?User:\s*\S+/im.test(result.stdout) && !/^\s*(?:[-*]\s*)?User:\s*(?:none|null|not authenticated)\s*$/im.test(result.stdout));
		if (!authenticated) add("credential", credential.name, "missing credential: " + credential.name,
			"Set " + credential.keys.join(" or ") + " in bb env" + (shared ? ", or in Infisical (secret-management " + shared.env + shared.path +
				") with this host's machine identity at " + required.infisical.identity : "") +
			", or authenticate with " + credential.command[0] + ". Values must not be included in this issue.");
	}
	return gaps;
}

const identity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) +
	"-" + createHash("sha256").update(value).digest("hex").slice(0, 10);

export function reportGaps(gaps: Gap[], tracker: Tracker, host = hostname()) {
	const existing = tracker.snapshot();
	const reported = new Set<string>();
	for (const gap of gaps) {
		const slug = "host-gap-" + identity(host) + "-" + gap.kind + "-" + identity(gap.name);
		if (reported.has(slug)) continue;
		reported.add(slug);
		const issue = existing.get(slug);
		if (issue && !issue.done) continue;
		const body = "Host: " + host + "\n\n" + gap.message + "\n\n" + gap.remedy +
			"\n\nFound by the pi host doctor. Run bun lib/doctor.ts in the mlegls-pi checkout after repair.\n";
		if (issue) tracker.update(slug, { stage: "ticket", assignee: "human" }, body);
		else tracker.create({ slug, fields: { stage: "ticket", assignee: "human", author: "host-doctor:" + host }, body });
	}
}

/** Runs in a child process, never on the session's startup critical path. */
export async function daily() {
	const dir = doctorDirectory();
	mkdirSync(dir, { recursive: true });
	const lock = join(dir, "lock");
	try {
		if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 86_400_000) rmSync(lock, { recursive: true });
		mkdirSync(lock);
	} catch { return; }
	try {
		const stamp = join(dir, "last-run");
		if (existsSync(stamp) && Date.now() - Number(readFileSync(stamp, "utf8")) < 86_400_000) return;
		writeFileSync(stamp, String(Date.now()));
		const gaps = await diagnose();
		if (gaps.length) reportGaps(gaps, getTracker(resolve(import.meta.dir, "..")));
	} finally { rmSync(lock, { recursive: true, force: true }); }
}

if (import.meta.main) {
	try {
		if (process.argv.slice(2).join(" ") === "--daily") await daily();
		else if (process.argv.length === 2) {
			const gaps = await diagnose();
			for (const gap of gaps) console.log(gap.message.replace(/[\r\n]/g, " "));
			process.exitCode = gaps.length ? 1 : 0;
		} else throw new Error("usage");
	} catch {
		// Auth and settings errors can contain secrets; never serialize caught errors.
		console.error("host doctor failed; check pi settings, bb access and tracker availability");
		process.exitCode = 1;
	}
}
