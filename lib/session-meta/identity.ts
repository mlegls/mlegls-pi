import { mailbox } from "../board/mailbox";

/** Resolve legacy supervision addresses only when they identify exactly one session. */
export function resolveSession(ref: string, ids: Iterable<string>): string | undefined {
	const id = ref.replace(/^session\//, "");
	if (!id.startsWith("mail/")) return id;
	const matches = [...ids].filter(candidate => mailbox(candidate) === id);
	return matches.length === 1 ? matches[0] : undefined;
}
