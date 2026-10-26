// Read-only first-use target for a verifier on Beelink: bundle this checkout's collector onto the
// enrolled Mac. No checkout, database, SSH trust or seed is changed. Requires the owner's bb login.
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const host = process.argv[2] ?? "host_w74xscm3fz";
const dir = "/private/tmp/mlegls-profile-" + randomUUID();
async function bb(args: string[], input?: Blob | string): Promise<string> {
	const p = Bun.spawn(["bb", ...args], { stdin: input === undefined ? "ignore" : typeof input === "string" ? new Blob([input]) : input, stdout: "pipe", stderr: "pipe" });
	const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
	if (code) throw new Error(err || out);
	return out;
}
const machine = JSON.parse(await bb(["machine", "show", host, "--json"]));
if (machine.status !== "connected") throw new Error(host + " is not connected");
const build = await Bun.build({
	entrypoints: [fileURLToPath(new URL("../../../lib/profile-project.ts", import.meta.url))],
	target: "bun", minify: true,
});
if (!build.success) throw new Error(build.logs.join("\n"));
console.log("Owned target: " + host + ":" + dir);
await bb(["file", "write", dir + "/collector.ts", "--host", host, "--create-parents", "--stdin"], build.outputs[0]);
const runner = [
	'import { projectReport } from "./collector.ts";',
	'console.log(await projectReport(',
	'  { project: "concept", since: Date.parse("2026-10-21T21:30Z"), until: Date.parse("2026-10-25T21:35Z"), evidence: true },',
	'  { hosts: ["beelink"], byThread: true, last: Infinity, json: false, evidence: import.meta.dir + "/evidence" }',
	'));',
].join("\n");
await bb(["file", "write", dir + "/run.ts", "--host", host, "--stdin"], runner);
console.log(JSON.stringify({
	host, dir, persona: "owner's enrolled bb and existing Mac→Beelink SSH", seed: "existing read-only session logs and BB databases",
	entry: "bb terminal create --host " + host + " --command 'bun " + dir + "/run.ts' --json",
	evidence: dir + "/evidence/index.md",
	cleanup: "bb file remove " + dir + " --host " + host + " --recursive --yes",
}, null, 2));
