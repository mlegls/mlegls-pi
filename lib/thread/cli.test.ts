import { expect, test } from "bun:test";
import { rowLine } from "./cli";
import type { ThreadRow } from "./types";

test("row formatter keeps a multiline blocked reason on one line with bounded summaries", () => {
	const reason = "Archive conflict unresolved\r\nblocked\n" + "details ".repeat(40);
	const row: ThreadRow = {
		thread: {
			id: "child", sessionId: "child", sessionFile: "/tmp/child.jsonl",
			cwd: "/tmp/repo", project: "/tmp/repo", ownership: "guest", archived: false,
			created: "2026-10-14T00:00:00Z",
			blocked: { action: "archive", parentBranch: "main", files: [], reason },
		},
		state: "exited", terminals: [], interactive: false, attention: "needs-you", depth: 1,
	};
	const line = rowLine(row);
	expect(line).not.toMatch(/[\r\n]/);
	const compact = reason.replace(/\s+/g, " ").slice(0, 159) + "…";
	expect(line).toEndWith(" blocked=archive:" + compact);
	expect(row.thread.blocked?.reason).toBe(reason);
});
