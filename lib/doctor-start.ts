import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

export function doctorDirectory() {
	const host = createHash("sha256").update(hostname()).digest("hex").slice(0, 16);
	return join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent"), "doctor", host);
}

/** Best-effort startup trigger. The child owns locking, checks and tracker writes. */
export function startDoctor() {
	try {
		const stamp = Number(readFileSync(join(doctorDirectory(), "last-run"), "utf8"));
		if (Date.now() - stamp < 86_400_000) return;
	} catch { /* First session on this host. */ }
	try {
		const child = spawn("bun", [join(import.meta.dir, "doctor.ts"), "--daily"], {
			detached: true, stdio: "ignore",
		});
		child.on("error", () => {}); // Missing bun must not fail session startup.
		child.unref();
	} catch { /* The doctor never blocks or fails a session. */ }
}
