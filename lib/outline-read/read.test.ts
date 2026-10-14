import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Value } from "typebox/value";
import { Ledger } from "./ledger";
import { registerReadTool } from "./read";

// The public tool result is the bridge to codemode: structuredContent, not the caption.
test("read exposes image blocks, text, and ordered multi-file results to codemode", async () => {
	const dir = await mkdtemp(join(tmpdir(), "read-output-"));
	try {
		const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==";
		await writeFile(join(dir, "x.png"), Buffer.from(png, "base64"));
		await writeFile(join(dir, "a.txt"), "hello\n");
		await writeFile(join(dir, "b.txt"), "world\n");
		let tool: any;
		registerReadTool({ registerTool: (definition: any) => { tool = definition; } } as any, {
			ledger: new Ledger(), persist: () => {}, sources: [], plain: true,
		});
		const read = async (path: string) => {
			const result = await tool.execute("read", { path }, undefined, undefined, { cwd: dir });
			expect(tool.outputSchema).toBeDefined();
			expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(true);
			return result;
		};
		const text = await read("a.txt");
		expect(text.structuredContent).toBe("a.txt (1 lines)\nhello");
		const image = await read("x.png");
		const block = image.content.find((c: any) => c.type === "image");
		expect(block).toBeDefined();
		expect(image.structuredContent).toEqual({ ...block, note: image.content[0].text });
		expect(image.structuredContent.mimeType).toBe("image/png");
		expect(Buffer.from(image.structuredContent.data, "base64").length).toBeGreaterThan(0);
		const other = await read("b.txt");
		expect((await read("a.txt b.txt")).structuredContent).toBe(text.structuredContent + "\n\n" + other.structuredContent);
		const mixed = await read("a.txt x.png b.txt x.png");
		expect(mixed.structuredContent).toEqual([text.structuredContent, image.structuredContent, other.structuredContent, image.structuredContent]);
		expect(mixed.content.filter((c: any) => c.type === "image")).toHaveLength(2);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
