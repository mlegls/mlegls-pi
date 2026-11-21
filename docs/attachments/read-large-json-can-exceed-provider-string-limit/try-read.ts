import { CodemodeSandbox } from "@earendil-works/pi-codemode";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import fragment from "../../../extensions/fragment";

// Run from the checkout root. The synthetic receipt and offline pi stub are disposable.
const scratch = resolve(".wm");
await mkdir(scratch, { recursive: true });
const cwd = await mkdtemp(join(scratch, "receipt-read-"));
let sandbox: CodemodeSandbox | undefined;
try {
	process.env.PI_CODING_AGENT_DIR = join(cwd, "agent");
	process.env.PATH = `${cwd}:${process.env.PATH}`;
	process.env.PI_WARPGREP = "0";
	await writeFile(join(cwd, "pi"), `#!/bin/sh
bytes=$(wc -c)
if [ "$bytes" -gt 10485760 ]; then
  printf "OpenAI API error (400): Expected maximum length 10485760, got %s instead.\\n" "$bytes" >&2
  exit 1
fi
printf '[{"name":"openings","kind":"key","startLine":2}]\\n'
`, { mode: 0o700 });
	const opening = JSON.stringify({
		passed: true,
		openings: Array.from({ length: 5000 }, (_, id) => ({
			id, original: "a".repeat(1500), member: "b".repeat(1500),
		})),
	}, null, 2);
	await Promise.all(Object.entries({
		"consumer.md": "# Consumer\nUses the opening receipt.\n",
		"surface.ts": "export const surface = 'deck';\n",
		"import.json": '{"actual":5000}\n',
		"opening.json": opening,
		"metrics.json": '{"measured":5000}\n',
	}).map(([name, value]) => writeFile(join(cwd, name), value)));

	let read: any;
	fragment({ registerTool: (tool: any) => { if (tool.name === "read") read = tool; } } as ExtensionAPI);
	sandbox = new CodemodeSandbox({ tools: [{
		name: read.name, description: read.description,
		inputSchema: read.parameters, outputSchema: read.outputSchema,
		execute: async (args, { signal }) => (await read.execute("receipt-read", args, signal, undefined, { cwd })).structuredContent,
	}] });
	console.log(`opening.json: ${Buffer.byteLength(opening)} bytes`);
	const result = await sandbox.execute(process.argv[2] ?? String.raw`
const receipt = await tools.read({path: "consumer.md surface.ts import.json opening.json metrics.json"});
text({characters: receipt.length, start: receipt.slice(0, 260), end: receipt.slice(-180)});
const continuation = receipt.match(/continue with (opening\.json:\d+-)/);
if (continuation) {
  const start = Number(continuation[1].split(":")[1].slice(0, -1));
  const next = await tools.read({path: "opening.json:" + start + "+3"});
  text({resumed: next.slice(0, 120)});
}`);
	console.log(JSON.stringify(result, null, 2));
	if (!result.ok) process.exitCode = 1;
} finally {
	await sandbox?.close();
	await rm(cwd, { recursive: true, force: true });
}
