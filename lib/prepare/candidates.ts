// Loaded only in the private candidate reader, never as a parent-session tool.
import { Type, type Static } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const parameters = Type.Object({
  candidates: Type.Array(Type.String({ minLength: 1 }), {
    maxItems: 5,
    description: "Up to five grounded session directives in prose, each with a concrete result, carrying skill/stance, first action, why-now, and stopping condition. Empty means substantial triage is needed. An idle directive is valid for a definitively empty or blocked frontier.",
  }),
});
export type Candidates = Static<typeof parameters>;

export default function (pi: ExtensionAPI) {
  pi.registerTool(defineTool({
    name: "submit_candidates",
    label: "Submit candidate sessions",
    description: "Deliver the candidate sessions to the parent workflow. This is a read-only return channel, not worker dispatch. Call once as your final action; no final prose response is needed.",
    parameters,
    async execute(_id, params) {
      if (params.candidates.some(text => !text.trim())) throw new Error("A candidate must contain a session directive");
      return { content: [{ type: "text", text: "Candidate sessions received." }], details: params, terminate: true };
    },
  }));
}
