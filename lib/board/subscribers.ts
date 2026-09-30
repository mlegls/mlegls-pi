import { basename, dirname } from "node:path";
import { compileQuery } from "./query";
import { mailbox } from "./mailbox";
import { readLive, type BoardSubscription } from "../session-meta/live";
import { scopes } from "./scopes";

export type SubscriberStatus = "live" | "none" | "unknown";

function matches(topic: string, subscription: BoardSubscription): boolean {
	if (!subscription || typeof subscription.topic !== "string") return false;
	try {
		return compileQuery({ topic: subscription.topic, tags: subscription.tags })(topic, []);
	} catch {
		return false;
	}
}

/** Whether a local session can receive an untagged message on this topic. */
export function subscriberStatus(destination: string): SubscriberStatus {
	const topic = destination.includes("/") ? destination
		: /^[0-9a-f]{8}$/i.test(destination) ? "mail/" + destination.toLowerCase()
		: mailbox(destination);
	const scopeRepo = /^(?:wt|ticket)\/([^/]+)\//.exec(topic)?.[1];
	let unknown = false;
	for (const session of readLive()) {
		if (session.subscriptions !== undefined) {
			if (session.subscriptions.some(subscription => subscription.wake && matches(topic, subscription))) return "live";
			continue;
		}
		// Older live records predate snapshots; every session still has its default mailbox and scopes.
		if (mailbox(session.sessionId) === topic) return "live";
		if (scopeRepo && (basename(session.cwd) === scopeRepo || basename(dirname(session.cwd)) === scopeRepo + "__worktrees")) {
			try { if (scopes(session.cwd, {}).includes(topic)) return "live"; } catch {}
		}
		unknown = true;
	}
	}
	return unknown ? "unknown" : "none";
}
