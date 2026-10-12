// bb releases an idle thread's pi after 30 minutes, and a released pi can't see the board, so mail to it would wait
// until someone typed into the thread. A board send to a bb-run thread's mailbox or worker topic whose pi isn't
// running resumes it with a message instead; the board host attaches the waiting mail to that turn (catch-up from its
// cursor, then before_agent_start).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readLive } from "../session-meta/live";
import { bbIndex, threadDir } from "./registry";

const mailboxOf = (sessionId: string) => "mail/" + sessionId.replaceAll("-", "").slice(-8);
const DEBOUNCE_MS = 60_000;

export function wakeBb(message: { topic: string; from: { session?: string } }): void {
	if (!existsSync(join(threadDir(), "bb-index.json"))) return;
	for (const [id, entry] of Object.entries(bbIndex())) {
		if (message.topic !== mailboxOf(entry.sessionId) && message.topic !== entry.topic) continue;
		if (message.from.session === entry.sessionId) continue;
		if (readLive().some(l => l.sessionId === entry.sessionId)) continue; // running: its board host delivers
		// One resume per burst: the turn it starts takes everything pending.
		const stamp = join(threadDir(), id + ".bb-woke");
		try { if (Date.now() - Number(readFileSync(stamp, "utf8")) < DEBOUNCE_MS) continue; } catch {}
		writeFileSync(stamp, String(Date.now()));
		const child = spawn(process.env.BB_CLI || "bb", ["thread", "tell", entry.bb, "Board mail arrived while this session was unloaded; it is attached."], { detached: true, stdio: "ignore" });
		child.on("error", () => {});
		child.unref();
	}
}
