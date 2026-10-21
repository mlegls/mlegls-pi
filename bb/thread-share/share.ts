// The pieces of a thread share that don't need bb: pi's HTML export of a session file, a scan for things that look
// like credentials, and ht-ml.app's site API (POST /v1/sites creates, PUT /v1/sites/:id with the update key as bearer
// replaces; there is no delete).
import { execFile, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const home = homedir();
let piPath: string | undefined;

/** The pi binary: the configured path, else what the login shell finds (the daemon's PATH may lack mise shims). */
export function pi(configured: string): string {
	if (configured) return configured.replace(/^~\//, home + "/");
	if (piPath) return piPath;
	try { piPath = execFileSync(process.env.SHELL || "/bin/zsh", ["-lc", "command -v pi"], { encoding: "utf8" }).trim().split("\n").at(-1); } catch {}
	if (!piPath || !existsSync(piPath)) piPath = [join(home, ".local/bin/pi"), "/opt/homebrew/bin/pi", "/usr/local/bin/pi"].find(existsSync) ?? "pi";
	return piPath;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** pi's self-contained HTML export of a session file, titled with the thread's title and marked noindex. */
export async function exportSession(piBin: string, sessionFile: string, title: string): Promise<string> {
	const dir = mkdtempSync(join(tmpdir(), "bb-thread-share-"));
	try {
		const out = join(dir, "session.html");
		await run(piBin, ["--export", sessionFile, out], { cwd: dir, timeout: 120_000, maxBuffer: 4 << 20 });
		return retitle(readFileSync(out, "utf8"), title);
	} finally { rmSync(dir, { recursive: true, force: true }); }
}

export function retitle(html: string, title: string): string {
	const head = '<meta name="robots" content="noindex">';
	const t = "<title>" + escapeHtml(title) + "</title>";
	const titled = /<title>[\s\S]*?<\/title>/i.test(html) ? html.replace(/<title>[\s\S]*?<\/title>/i, () => t) : html.replace(/<head>/i, () => "<head>" + t);
	return titled.replace(/<head>/i, () => "<head>" + head);
}

/** ht-ml.app refuses request bodies over 6 MiB (6291456 bytes, JSON-encoded HTML included). */
export const MAX_BODY = 6_291_456;

const LOADER = String.raw`<script>(async()=>{const el=document.getElementById("session-data");const gz=Uint8Array.from(atob(el.textContent.trim()),(c)=>c.charCodeAt(0));const json=new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());let s="";for(let i=0;i<json.length;i+=32768)s+=String.fromCharCode.apply(null,json.subarray(i,i+32768));el.textContent=btoa(s);const main=document.createElement("script");main.textContent=document.getElementById("thread-share-main").textContent;document.body.appendChild(main);})();</script>`;

/**
 * pi's export embeds the session as base64 JSON that its last inline script decodes synchronously. Gzip that payload
 * (JSON shrinks ~10x), park the script as inert text, and run it after a loader has decompressed the payload back to
 * the base64 it expects. Null when the export doesn't have the expected shape, so callers upload it unchanged.
 */
export function compress(html: string, options: { images?: boolean } = {}): string | null {
	const data = /(<script id="session-data" type="application\/json">)([A-Za-z0-9+/=\s]+)(<\/script>)/.exec(html);
	const reads = html.indexOf("getElementById('session-data')");
	if (!data || reads < 0) return null;
	const open = html.lastIndexOf("<script>", reads);
	const close = html.indexOf("</script>", reads);
	if (open < 0 || close < 0 || html.slice(open + 8, reads).includes("</script>")) return null;
	const body = html.slice(open + 8, close);
	let json = Buffer.from(data[2].trim(), "base64");
	if (options.images === false) json = Buffer.from(JSON.stringify(omitImages(JSON.parse(json.toString("utf8")))));
	const gz = gzipSync(json, { level: 9 }).toString("base64");
	const main = '<script type="text/plain" id="thread-share-main">' + body + "</script>" + LOADER;
	const swapped = html.slice(0, open) + main + html.slice(close + 9);
	return swapped.replace(data[0], () => data[1] + gz + data[3]);
}

/** Image blocks (screenshots, mostly) as a text note; they are most of a large session and don't compress. */
export function omitImages(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(omitImages);
	if (!value || typeof value !== "object") return value;
	const o = value as Record<string, unknown>;
	if (o.type === "image" && typeof o.data === "string") return { type: "text", text: "[image omitted from the published copy]" };
	return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, omitImages(v)]));
}

/** Credential-shaped strings, by kind and count. A hint for the confirmation, not a guarantee of anything. */
const SECRETS: [string, RegExp][] = [
	["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
	["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
	["OpenAI-style key", /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{32,}/g],
	["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g],
	["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
	["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
	["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
	["Stripe key", /\b[rs]k_live_[0-9A-Za-z]{20,}/g],
	["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
];

export function scanSecrets(text: string): { kind: string; count: number }[] {
	return SECRETS.map(([kind, re]) => ({ kind, count: new Set(text.match(re) ?? []).size })).filter((f) => f.count > 0);
}

export const newPassword = () => randomBytes(12).toString("base64url");

export interface Site { url: string; siteId: string; updateKey: string }

const API = "https://api.ht-ml.app";

async function request(method: "POST" | "PUT", path: string, body: unknown, bearer?: string): Promise<Record<string, unknown>> {
	const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "bb-plugin-thread-share" };
	if (bearer) headers.authorization = "Bearer " + bearer;
	const res = await fetch(API + path, { method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
	const text = await res.text();
	let data: Record<string, unknown> = {};
	try { data = JSON.parse(text) as Record<string, unknown>; } catch {}
	if (!res.ok) throw new Error("ht-ml.app " + method + " " + path + " failed (" + res.status + "): " + (String(data.error ?? data.message ?? "") || text.slice(0, 300)));
	return data;
}

/** A new site. A password makes it private; without one anyone with the link can read it. */
export async function create(html: string, password?: string): Promise<Site> {
	const data = await request("POST", "/v1/sites", { html_content: html, ...(password ? { password } : {}) });
	const url = typeof data.url === "string" ? data.url : "";
	const updateKey = typeof data.update_key === "string" ? data.update_key : "";
	const siteId = typeof data.site_id === "string" ? data.site_id : "";
	if (!url || !updateKey || !siteId) throw new Error("ht-ml.app published the page but returned no " + [!url && "url", !updateKey && "update_key", !siteId && "site_id"].filter(Boolean).join("/") + (url ? ": " + url : ""));
	return { url, siteId, updateKey };
}

/** Replace a site's HTML in place. A password sets or rotates one; ht-ml.app can't remove a password. */
export async function update(site: Site, html: string, password?: string): Promise<void> {
	await request("PUT", "/v1/sites/" + encodeURIComponent(site.siteId), { html_content: html, ...(password ? { password } : {}) }, site.updateKey);
}

export const UNPUBLISHED = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Unpublished</title></head><body><p>This page has been unpublished.</p></body></html>';
