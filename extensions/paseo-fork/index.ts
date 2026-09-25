import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// Loaded on use: @getpaseo/client costs ~35 MB per pi process, and most sessions never fork.
const loadPaseo = () => import("../../lib/paseo.js");

/** Paseo's UI fork creates a chat-history attachment, then starts a new agent with it. */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("fork-tab", {
    description: "Fork this Paseo conversation into a new tab in the same workspace",
    handler: async (_args, ctx) => {
      const sourceId = process.env.PASEO_AGENT_ID;
      if (!sourceId) {
        ctx.ui.notify("/fork-tab requires a Paseo agent", "error");
        return;
      }
      try {
        const paseo = await loadPaseo();
        const result = await paseo.withClient(async (client) => {
          const source = client.agents.ref(sourceId);
          const snapshot = await source.refresh();
          const agent = snapshot?.agent;
          if (!agent || !source.workspaceId) throw new Error("Source agent or workspace unavailable");
          const fork = await paseo.forkContext(sourceId);
          if (!fork.attachment) throw new Error("Paseo returned no fork history");
          const model = agent.model ?? agent.runtimeInfo?.model;
          if (!model) throw new Error("Source model unavailable");
          const created = await client.workspaces.ref(source.workspaceId).agents.create({
            requestId: randomUUID(),
            config: {
              provider: `pi/${model}`,
              ...(agent.thinkingOptionId ? { thinkingOptionId: agent.thinkingOptionId } : {}),
            },
            title: `Fork of ${agent.title || sourceId}`,
            attachments: [fork.attachment],
            // No prompt: the new tab opens with the inherited history, ready for input.
          });
          return created.id;
        });
        ctx.ui.notify(`Forked into Paseo agent ${result}`, "info");
      } catch (error) {
        ctx.ui.notify(`Paseo fork uncertain; inspect agents before retrying: ${String(error)}`, "error");
      }
    },
  });
}
