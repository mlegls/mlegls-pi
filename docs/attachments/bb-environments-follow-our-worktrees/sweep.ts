// One-off local-host sweep; dry run by default. Never interpret remote paths on this host.
import { existsSync } from "node:fs";
const cli = process.env.BB_CLI || "bb";
async function bb(args: string[]): Promise<any> {
	const p = Bun.spawn([cli, ...args, "--json"], { stdout: "pipe", stderr: "pipe" });
	const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
	if (code) throw new Error(err || out);
	const value = JSON.parse(out);
	if (value?.ok === false) throw new Error(JSON.stringify(value.error));
	return value;
}
const status = await bb(["status"]);
const host = status.thread?.environment?.hostId;
if (!host) throw new Error("Run inside a bb thread on the host whose paths are checked");
const rows: any[] = [];
for (let offset = 0; ; offset += 200) {
	const page = await bb(["environment", "list", "--status", "ready", "--host", host, "--limit", "200", "--offset", String(offset)]);
	rows.push(...page);
	if (page.length < 200) break;
}
const stale = rows.filter(e => e.path && !existsSync(e.path));
const apply = process.argv.includes("--apply");
console.log(JSON.stringify({ host, ready: rows.length, stale: stale.length, apply }));
let requested = 0;
let alreadyGone = 0;
const failed: { id: string; error: string }[] = [];
for (const e of stale) {
	if (!apply) continue;
	// Recheck immediately before the destructive request; never remove a re-created checkout.
	if (existsSync(e.path)) continue;
	try { await bb(["environment", "delete", e.id]); requested++; }
	catch (error) {
		if (/HTTP 404: Environment not found/.test(String(error))) alreadyGone++;
		else failed.push({ id: e.id, error: String(error) });
	}
}
console.log(JSON.stringify({ requested, alreadyGone, failed }));
if (failed.length) process.exitCode = 1;
