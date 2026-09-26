import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { switchWorkspace } from "./index";

for (const cancelled of [false, true]) test(`workspace persists handoff before switching (cancelled=${cancelled})`, async () => {
	const root = await mkdtemp(join(tmpdir(), "workspace-handoff-"));
	const source = SessionManager.create(root, root);
	source.appendMessage({ role: "user", content: "hello", timestamp: 1 });
	const file = source.getSessionFile()!;
	await writeFile(file, [source.getHeader(), ...source.getBranch()].map(e => JSON.stringify(e)).join("\n") + "\n");
	let targetFile = "";
	const ctx: any = {
		cwd: root, sessionManager: source, waitForIdle: async () => {}, ui: { notify() {} },
		switchSession: async (path: string) => {
			targetFile = path;
			const target = SessionManager.open(path);
			expect(target.getEntries().at(-1)).toMatchObject({ customType: "test-handoff", data: { source: file } });
			return { cancelled };
		},
	};
	try {
		await switchWorkspace(join(root, "target"), ctx, { events: { emit: (name: string, event: any) => {
			expect(name).toBe("workspace:handoff");
			expect(event.source).toBe(ctx);
			event.target.appendCustomEntry("test-handoff", { source: file });
		} } } as any);
		expect(source.getEntries()).toHaveLength(1);
		if (cancelled) await expect(readFile(targetFile)).rejects.toThrow();
		else expect((await readFile(targetFile, "utf8"))).toContain("test-handoff");
	} finally {
		if (targetFile) await rm(targetFile, { force: true });
		await rm(root, { recursive: true, force: true });
	}
});
