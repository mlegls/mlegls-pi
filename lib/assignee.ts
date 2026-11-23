// Selector syntax from the tracker lifecycle. Routing resolves stance and model names.
type ModelPin = { model: string; effort: string };
export type Assignee =
  | { kind: "agent"; stance?: string; pin?: ModelPin }
  | { kind: "human"; user?: string }
  | { kind: "session"; id: string };

const stanceName = (part: string) => /^agent:([a-z][a-z0-9-]*)$/.exec(part)?.[1];
function modelPin(part: string): ModelPin | undefined {
  const match = /^model:([^\s/,:]+\/[^\s,:]+):(none|minimal|low|medium|high|xhigh)$/.exec(part);
  if (match) return { model: match[1], effort: match[2] };
}

/** Appended to invalid-selector diagnostics so callers needn't look up the grammar. */
export const ASSIGNEE_GRAMMAR = "expected agent, human, user:<name>, session:<id>, agent:<stance> or model:<provider>/<model>:<none|minimal|low|medium|high|xhigh>; only one stance and one model override combine";

export function parseAssignee(value: unknown): Assignee | undefined {
  if (typeof value !== "string") return;
  const parts = value.split(",");
  if (parts.length === 2) {
    const [a, b] = parts.map(part => part.trim());
    const stance = stanceName(a) ?? stanceName(b);
    const pin = modelPin(a) ?? modelPin(b);
    if (stance && pin) return { kind: "agent", stance, pin };
    return;
  }
  if (parts.length !== 1 || value !== value.trim()) return;
  if (value === "agent" || value === "human") return { kind: value };
  const user = /^user:([^\s,]+)$/.exec(value)?.[1];
  if (user) return { kind: "human", user };
  const id = /^session:([^\s,]+)$/.exec(value)?.[1];
  if (id) return { kind: "session", id };
  const stance = stanceName(value);
  if (stance) return { kind: "agent", stance };
  const pin = modelPin(value);
  if (pin) return { kind: "agent", pin };
}
