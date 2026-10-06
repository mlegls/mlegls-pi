/**
 * Anthropic rejects the whole request (400 "all content must be type `text` if `is_error` is true")
 * when an errored tool result carries image blocks. codemode produces exactly that: a script that
 * calls image() and then throws returns its images alongside the error. Swap them for a note.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("tool_result", (event) => {
		if (!event.isError || !event.content.some((block) => block.type === "image")) return;
		const dropped = event.content.filter((block) => block.type === "image").length;
		return {
			content: [
				...event.content.filter((block) => block.type === "text"),
				{ type: "text" as const, text: `[${dropped} image${dropped === 1 ? "" : "s"} dropped: the tool errored, and providers reject images in error results]` },
			],
		};
	});
}
