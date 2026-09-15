// Read-only projections of public tool details; no backend state or ref allocation.
export function captureSummary(details: any) {
 if (!details || typeof details !== "object") return undefined;
 const c = details.capture;
 return Object.fromEntries(Object.entries({ stateId: c?.stateId ?? details.stateId, lookId: details.outline?.lookId ?? details.lookId, target: details.target && { app: details.target.app, windowTitle: details.target.windowTitle, windowRef: details.target.windowRef }, width: c?.width, height: c?.height, scaleFactor: c?.scaleFactor, returned: details.returned, totalMatches: details.totalMatches, hasMore: details.hasMore, complete: details.complete }).filter(([, v]) => v !== undefined));
}
export const discoveryRequested = (args: any) => args && ["subrole", "unlabeled", "limit"].some(k => Object.hasOwn(args, k));
export function discover(details: any, args: any) {
 for (const k of Object.keys(args)) if (!["stateId", "text", "role", "capability", "subrole", "unlabeled", "limit"].includes(k)) throw new Error("Unknown ui.search argument: " + k);
 for (const k of ["stateId", "text", "role", "capability", "subrole"]) if (args[k] !== undefined && typeof args[k] !== "string") throw new Error(k + " must be a string");
 if (args.unlabeled !== undefined && typeof args.unlabeled !== "boolean") throw new Error("unlabeled must be boolean");
 const limit = args.limit ?? 50;
 if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("limit must be an integer from 1 to 1000");
 const norm = (s: string) => s.trim().toLowerCase().replace(/^ax/, "");
 const matches: any[] = []; let truncatedNodes = 0;
 const visit = (n: any, path: string[]) => {
  if (n.truncated) truncatedNodes++;
  const label = n.title || n.description || n.value || (n.text ?? []).map((t: any) => t.string).join(" ");
  const next = [...path, n.ref];
  const actions = n.actions ?? [];
  if ((!args.role || norm(n.role ?? "") === norm(args.role)) && (!args.subrole || norm(n.subrole ?? "") === norm(args.subrole)) && (args.unlabeled === undefined || args.unlabeled === !label.trim()) && (!args.capability || actions.some((a: string) => norm(a) === norm(args.capability)) || n["can" + args.capability[0].toUpperCase() + args.capability.slice(1)] === true) && (!args.text || [label, n.identifier, n.title, n.description, n.value, ...(n.text ?? []).map((t: any) => t.string)].join(" ").toLowerCase().includes(args.text.toLowerCase()))) matches.push({ ref: n.ref, role: n.role, subrole: n.subrole, label, actions, path: next.join(" > ") });
  for (const child of n.children ?? []) visit(child, next);
 };
 visit(details.outline.root, []);
 const result = { tool: "search_ui", stateId: args.stateId, lookId: details.outline.lookId, matches: matches.slice(0, limit), totalMatches: matches.length, returned: Math.min(matches.length, limit), hasMore: matches.length > limit, complete: matches.length <= limit && truncatedNodes === 0, truncatedNodes, scope: "cached-outline", matching: "exact role/subrole/capability; substring text" };
 return { content: [{ type: "text", text: JSON.stringify(result) }], details: result, capture: captureSummary(result) };
}
