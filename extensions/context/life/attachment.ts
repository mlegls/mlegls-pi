// Attachment is branch state: resume and fork inherit the session entry, including an explicit off.
import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

export const ATTACHMENT = "life.attachment";
export interface Attachment { name: string; id: string }

export function attachment(ctx: ExtensionContext): Attachment | undefined {
	return attachedLife(ctx.sessionManager.getBranch());
}

export function attachedLife(branch: readonly SessionEntry[]): Attachment | undefined {
	for (const entry of [...branch].reverse()) {
		if (entry.type === "custom" && entry.customType === ATTACHMENT)
			return (entry.data as Attachment | null) ?? undefined;
	}
}
