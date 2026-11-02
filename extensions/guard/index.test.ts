import { expect, test } from "bun:test";
import { hookBypass } from "./index";

test("commit hook bypass detection respects the Git command's flags", () => {
	const cases: [string, string | undefined][] = [
		[`tmux -L translation-commit-c new-window -t commit -n retry -c "$PWD" 'git commit -m "Record joined Application Patch translation first use"; ...'`, undefined],
		["git commit -n", "commit -n"],
		["git commit -an -m x", "commit -n"],
		[`git commit -m "a -n b"`, undefined],
		[`tmux new-window -n retry 'git commit -n -m x'`, "commit -n"],
		[`bash -c 'git commit -n -m x'`, "commit -n"],
		["git commit --no-verify -m x", "--no-verify"],
		["git -c core.hooksPath= commit -m x", "core.hooksPath"],
	];
	for (const [command, reason] of cases) {
		expect(hookBypass(command), command).toBe(reason);
	}
});
