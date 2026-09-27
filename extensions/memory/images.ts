// Leave headroom below Anthropic's 32 MB body limit for provider serialization.
export const CONTEXT_BYTES = 24 * 1024 * 1024;
export const CHECKPOINT_BYTES = 8 * 1024 * 1024;
const marker = { type: "text", text: "[Image omitted from request to fit byte budget; original remains in session history. Reopen its source path if needed.]" };
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

/** Request-only projection: preserve text/path labels and evict images oldest first. */
export function trimImages<T extends { messages: any[] }>(context: T, budget = CONTEXT_BYTES): T {
	let size = bytes(context);
	if (size <= budget) return context;
	const replacementBytes = bytes(marker);
	const messages = context.messages.map(message => {
		if (!Array.isArray(message.content)) return message;
		let changed = false;
		const content = message.content.map((block: any) => {
			if (size <= budget || block.type !== "image") return block;
			const savings = bytes(block) - replacementBytes;
			if (savings <= 0) return block;
			size -= savings;
			changed = true;
			return { ...marker };
		});
		return changed ? { ...message, content } : message;
	});
	return { ...context, messages };
}
