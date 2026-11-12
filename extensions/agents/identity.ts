import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { named } from "../../lib/agents.ts";
import { attachedLife } from "../context/life/attachment.ts";

/** Only a registered machine-wide life supplies identity. */
export function attachedAgent(ctx: ExtensionContext) {
	const life = attachedLife(ctx.sessionManager.getBranch());
	return life?.id.startsWith("/") ? named(life.id.slice(1), ctx.cwd) : undefined;
}
