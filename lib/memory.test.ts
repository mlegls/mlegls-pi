import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { recall } from "./memory.ts";
import { Kernel } from "../extensions/exec/kernel.ts";

function fixture() {
	const cwd = mkdtempSync(join(tmpdir(), "memory-recall-")), sessionFile = join(cwd, "session.jsonl");
	const message = (id: string, parentId: string | null, content: any, role = "user") => ({ type: "message", id, parentId,
		timestamp: new Date(1).toISOString(), message: { role, content, timestamp: 1 } });
	writeFileSync(sessionFile, [
		{ type: "session", version: 3, id: "session", cwd, timestamp: new Date(1).toISOString() },
		message("root", null, "The original plan is cobalt."),
		message("left", "root", [{ type: "thinking", thinking: "PRIVATE_REASONING" }, { type: "text", text: "Left branch answer" }], "assistant"),
		message("right", "root", [{ type: "text", text: "Right branch answer" }, { type: "image", data: "PRIVATE_IMAGE", mimeType: "image/png" }]),
	].map(e => JSON.stringify(e)).join("\n") + "\n");
	return { cwd, sessionFile };
}

test("recall uses explicit ancestry, redacts reasoning/images, paginates and refuses missing coordinates", () => {
	const f = fixture();
	try {
		const text = recall({ ...f, leafId: "left", ids: ["root", "left", "right"] });
		expect(text).toContain("original plan is cobalt");
		expect(text).toContain("Left branch answer");
		expect(text).not.toContain("PRIVATE_REASONING");
		expect(text).not.toContain("Right branch answer");
		expect(text).toContain("not found on this branch");
		expect(recall({ ...f, leafId: "right", ids: ["right"] })).not.toContain("PRIVATE_IMAGE");
		const short = recall({ ...f, leafId: "left", ids: ["root", "left", "right"], limit: 30 });
		expect(short.slice(0, 30)).toBe(text.slice(0, 30));
		expect(short).toContain("offset=30");
		expect(() => recall({ ...f, ids: ["root"] })).toThrow("branch leaf");
		expect(() => recall({ ...f, leafId: "missing", ids: ["root"] })).toThrow("ancestry");
		expect(() => recall({ ...f, leafId: "left", ids: ["root"], limit: -1 })).toThrow("limit");
		const cli = Bun.spawnSync(["bun", fileURLToPath(new URL("../ab/main.ts", import.meta.url)), "memory", "recall", "root", "right", "--session", f.sessionFile, "--leaf", "left"]);
		expect(cli.exitCode).toBe(0);
		expect(cli.stdout.toString()).toContain("cobalt");
		expect(cli.stdout.toString()).not.toContain("Right branch answer");
	} finally { rmSync(f.cwd, { recursive: true, force: true }); }
});

test("exec recall and shell coordinates stay scoped to each concurrent cell", async () => {
	const f = fixture();
	const kernel = new Kernel({ cwd: f.cwd, sessionFile: f.sessionFile, ledger: [], persist() {} });
	kernel.setIngressEnabled(false);
	try {
		const [left, right] = await Promise.all([
			kernel.execute('await new Promise(r => setTimeout(r, 80)); show.raw(memory.recall({ids:["left","right"]})); show.raw((await sh("printenv PI_SESSION_LEAF")).stdout);', { sessionLeaf: "left" }),
			kernel.execute('show.raw(memory.recall({ids:["left","right"]})); show.raw(await $`printenv PI_SESSION_LEAF`.text());', { sessionLeaf: "right" }),
		]);
		expect(left.error).toBeUndefined();
		expect(right.error).toBeUndefined();
		expect(left.output).toContain("Left branch answer");
		expect(left.output).not.toContain("Right branch answer");
		expect(left.output.trimEnd()).toEndWith("left");
		expect(right.output).toContain("Right branch answer");
		expect(right.output).not.toContain("Left branch answer");
		expect(right.output.trimEnd()).toEndWith("right");
	} finally { await kernel.dispose(); rmSync(f.cwd, { recursive: true, force: true }); }
}, 20000);
