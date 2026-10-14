// No model, credentials or server required. Optional argument is a codemode script body.
import { CodemodeSandbox } from "@earendil-works/pi-codemode";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger } from "../../../lib/outline-read/ledger";
import { registerReadTool } from "../../../lib/outline-read/read";

const dir = await mkdtemp(join(tmpdir(), "codemode-read-first-use-"));
let sandbox: CodemodeSandbox | undefined;
try {
	await writeFile(join(dir, "x.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==", "base64"));
	await writeFile(join(dir, "hello.txt"), "hello from text\n");
	let read: any;
	registerReadTool({ registerTool: (tool: any) => { read = tool; } } as any, {
		ledger: new Ledger(), persist: () => {}, sources: [], plain: true,
	});
	sandbox = new CodemodeSandbox({ tools: [{
		name: read.name, description: read.description,
		inputSchema: read.parameters, outputSchema: read.outputSchema,
		execute: async (args, { signal }) => {
			const result = await read.execute("first-use", args, signal, undefined, { cwd: dir });
			// Same selection as pi's codemode bridge: schema-bearing tools expose structuredContent.
			return read.outputSchema ? result.structuredContent : result.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
		},
	}] });
	const result = await sandbox.execute(process.argv[2] ?? 'image(await tools.read({path: "x.png"})); text(await tools.read({path: "hello.txt"})); const mixed = await tools.read({path: "hello.txt x.png"}); text(mixed[0]); image(mixed[1]);');
	console.log(JSON.stringify(result.ok ? {
		ok: true,
		output: result.output.map((item) => item.type === "image" ? { type: item.type, mimeType: item.mimeType, bytes: Buffer.from(item.data, "base64").length } : item),
	} : result, null, 2));
	if (!result.ok) process.exitCode = 1;
} finally {
	await sandbox?.close();
	await rm(dir, { recursive: true, force: true });
}
