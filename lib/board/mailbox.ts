// Every pi session's mailbox: a board topic it subscribes to with wake, so a message there starts
// its next turn (or waits for the current one to end). Short enough to read off a status bar.
import { send, type Message } from "./store";

/** mail/<last 8 hex of the session id> (the random end of a UUIDv7). */
export function mailbox(sessionId: string): string {
	return "mail/" + sessionId.replaceAll("-", "").slice(-8);
}

/** Post to a mailbox (mail/xxxxxxxx, bare xxxxxxxx, or a full session id) or any other topic
 * (wt/<repo>/<branch>, ticket/<repo>/<slug>: lib/board/scopes), signed with the sender's
 * mailbox when it's a pi session, so the reader can reply. */
export function mail(to: string, body: string, from: { session?: string; name?: string } = {}): Message {
	const topic = to.includes("/") ? to : /^[0-9a-f]{8}$/i.test(to) ? "mail/" + to.toLowerCase() : mailbox(to);
	const session = from.session ?? process.env.PI_SESSION_ID;
	return send({ topic, tags: [], from: { ...(session && { session }), name: from.name ?? (session ? mailbox(session) : "ab") }, body });
}
