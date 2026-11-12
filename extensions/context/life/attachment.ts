// Attachment is branch state: resume and fork inherit the session entry, including an explicit off.
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const ATTACHMENT = "life.attachment";
export interface Attachment { name: string; id: string }

export function attachment(ctx: ExtensionContext): Attachment | undefined {
	for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
		if (entry.type === "custom" && entry.customType === ATTACHMENT)
			return (entry.data as Attachment | null) ?? undefined;
	}
}
