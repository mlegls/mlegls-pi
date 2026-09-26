// Local historical specimen: no private query/source text is copied into receipts.
// bun docs/research/skim-fidelity/readback.ts > /tmp/skim-readback.jsonl
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { judge, type Chunk } from "../../../lib/ingress.ts";
const root = join(homedir(), ".pi/agent/sessions");
const file = readdirSync(root).flatMap(d => { try { return readdirSync(join(root, d)).map(f => join(root, d, f)); } catch { return []; } }).find(f => f.includes("2026-09-23T13-42-33-432Z") && f.endsWith(".jsonl"))!;
const entries = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const event = entries.filter(e => e.type === "custom" && e.customType === "exec-ingress" && e.data.type === "filter")[5].data;
const call = entries.flatMap(e => e.message?.content instanceof Array ? e.message.content : []).find(c => c.type === "toolCall" && c.arguments?.command?.startsWith("cat > design.md <<'EOF'"));
const command: string = call.arguments.command;
const chunks: Chunk[] = event.pages.map((p: Chunk) => ({ text: p.text, label: p.label, context: p.context }));
console.log(JSON.stringify({ type: "manifest", session: file.split("/").at(-1), index: 5, commandLength: command.length, suffix: command.slice(command.lastIndexOf("\nEOF") + 1), queryEndsAt4000: event.query.endsWith(command.slice(0, 4000)), sourceHashes: chunks.map(c => createHash("sha256").update(c.text).digest("hex")) }));
for (const variant of ["recorded", "full-command", "explicit-focus"] as const) {
  const query = variant === "full-command" ? event.query.split("\n\nCurrent exec cell:\n")[0] + "\n\nCurrent exec cell:\n" + command : event.query;
  const focus = variant === "explicit-focus" ? "Verify the contents of design.md just written by this command." : undefined;
  for (let run = 0; run < 2; run++) console.log(JSON.stringify({ variant, run, judgments: await judge(chunks, query, focus) }));
}
