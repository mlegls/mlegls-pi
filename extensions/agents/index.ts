import { loadSkillsFromDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executions, named, namedAgents } from "../../lib/agents.ts";
import { notice } from "../../lib/notice.ts";
import { attachment } from "../context/life/attachment.ts";
import { register } from "../stances/index.ts";
import { attachedAgent } from "./identity.ts";

export default function agents(pi: ExtensionAPI) {
	register(pi, "agent", namedAgents(process.cwd()).flatMap((a) => a.routing ? [{ name: a.name, list: executions(a.routing) }] : []));
	const start = (model: ExtensionContext["model"], ctx: ExtensionContext) => {
		if (model?.provider !== "agent" || attachment(ctx)) return;
		if (!named(model.id, ctx.cwd)) return;
		const name = "/" + model.id;
		const history = ctx.sessionManager.getBranch().some((e) => e.type === "message" && (e.message.role === "user" || e.message.role === "assistant"));
		if (history) notice(pi, ctx, "Use /life " + name + " to attach this session's history to the agent", "info");
		else pi.events.emit("life:attach", { name, ctx });
	};
	pi.on("session_start", (_e, ctx) => start(ctx.model, ctx));
	pi.on("model_select", (e, ctx) => start(e.model, ctx));
	pi.on("before_agent_start", (event, ctx) => {
		const a = attachedAgent(ctx);
		if (!a) return;
		const skills = join(a.dir, "skills");
		const values: Record<string, string> = { name: a.name, soul: a.soul, skills, dir: a.dir };
		const lesson = readFileSync(new URL("./lesson.md", import.meta.url), "utf8").trim().replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
		event.systemPromptOptions.sections.agent = a.body + "\n\n" + lesson;
		event.systemPromptOptions.skills.push(...loadSkillsFromDir({ dir: skills, source: "agent/" + a.name }).skills);
	});
}
