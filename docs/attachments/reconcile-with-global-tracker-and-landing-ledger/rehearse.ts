// Combined actual-run rehearsal. Each child owns and cleans its isolated fixture.
import { join } from "node:path";

const modes: Record<string, string[]> = {
	sparse: ["sparse.ts"],
	collector: ["ledger.ts", "collector"],
	restart: ["ledger.ts", "restart"],
	"close-replay": ["ledger.ts", "close-replay"],
	"linked-owner": ["ledger.ts", "linked-owner"],
	failed: ["refinement.ts", "failed"],
	replaced: ["refinement.ts", "replaced"],
	adopted: ["refinement.ts", "adopted"],
	"accept-replay": ["refinement.ts", "accept-replay"],
};
const selected = process.argv[2] ?? "all";
if (process.argv.length > 3 || (selected !== "all" && !Object.hasOwn(modes, selected))) {
	console.error("Use all|" + Object.keys(modes).join("|"));
	process.exit(2);
}
const chosen = selected === "all" ? Object.keys(modes) : [selected];
for (const mode of chosen) {
	const [script, ...args] = modes[mode];
	console.log("REHEARSAL start " + mode);
	// Fresh process/module caches: no runtime imports before the child's isolation.
	const child = Bun.spawn([process.execPath, join(import.meta.dir, script), ...args], {
		stdout: "inherit", stderr: "inherit",
	});
	const code = await child.exited;
	if (code !== 0) {
		console.error("REHEARSAL failed " + mode + " (exit " + code + ")");
		process.exit(code);
	}
	console.log("REHEARSAL held " + mode);
}
console.log("REHEARSAL complete: " + chosen.length + " modes held");
