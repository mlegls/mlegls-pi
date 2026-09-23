
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
const root = process.env.HOME + "/.pi/agent/sessions";
const out = Bun.file("/tmp/exec-audit/calls.jsonl").writer();
async function* walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) yield* walk(p); else if (e.name.endsWith(".jsonl")) yield p; } }
let n = 0;
for await (const f of walk(root)) {
  let txt; try { txt = await readFile(f, "utf8"); } catch { continue; }
  const pending = new Map(); let cwd = null, model = null, userTurns = 0, sid = f;
  for (const line of txt.split("\n")) {
    if (!line) continue; let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "session") cwd = e.cwd;
    if (e.type === "model_change") model = e.modelId;
    if (e.type !== "message") continue;
    const m = e.message;
    if (m.role === "user") userTurns++;
    if (m.role === "assistant" && Array.isArray(m.content)) {
      const calls = m.content.filter(c => c.type === "toolCall");
      for (const c of calls) pending.set(c.id, { f: sid, cwd, model: m.model ?? model, ts: e.timestamp, tool: c.name, args: c.arguments, siblings: calls.length, turn: userTurns, out: m.usage?.output ?? null });
    }
    if (m.role === "toolResult") {
      const c = pending.get(m.toolCallId); if (!c) continue; pending.delete(m.toolCallId);
      const text = (m.content ?? []).filter(x => x.type === "text").map(x => x.text).join("\n");
      c.isError = !!m.isError; c.resLen = text.length; c.res = text.slice(0, 1500); c.resTail = text.length > 1500 ? text.slice(-500) : "";
      out.write(JSON.stringify(c) + "\n"); n++;
    }
  }
}
await out.end(); console.log(n);
