import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Unit-level contract for docs/attachments/native-computer-lacks-a-manual-llm-path/index.md,
// checks 4 (discovery) and 5 (role prohibition). Cua behavior (checks 1-3, 6) needs a live
// native window and stays a manual replay in that packet.

const root = resolve(import.meta.dir, "..");
// Read this checkout's role files directly: lib/agents.ts reads the installed ~/.pi/agent/agents, not the checkout.
const roleBody = (role: string) => readFileSync(resolve(root, "agents/roles", role + ".md"), "utf8");

for (const role of ["drive", "review"]) {
	test(`${role} role forbids unscoped System Events input and points at cua-driver (check 5)`, () => {
		const body = roleBody(role).replace(/\s+/g, " ");
		for (const op of ["`keystroke`", "`key code`", "`click at`", "`set frontmost`"]) expect(body).toContain(op);
		expect(body).toContain("`cua-driver`");
		expect(body).toContain("stop and report");
	});
}

test("docs/computer.md names cua-driver beside chrome-devtools-axi and links an existing skill (check 4)", () => {
	const doc = readFileSync(resolve(root, "docs/computer.md"), "utf8");
	expect(doc).toContain("`chrome-devtools-axi`");
	expect(doc).toContain("`cua-driver`");
	expect(doc).toContain("cua-driver get_window_state");
	expect(doc).toContain("permissions status");
	const link = doc.match(/\]\((\.\.\/skills\/enabled\/all\/cua-driver\/SKILL\.md)\)/);
	expect(link).not.toBeNull();
	expect(existsSync(resolve(root, "docs", link![1]))).toBe(true);
});
