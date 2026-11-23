import { parseDocument } from "yaml";
import { commitHandoffError } from "./commit-handoff.ts";

export const HANDOFF_KEYS = ["commit", "setup", "stories", "evidence", "caveats", "question", "resolution"] as const;

type Status = "done" | "blocked" | "needs-input" | "checkpoint" | "waiting";
export interface Report {
  status: Status | null;
  handoff: Record<string, unknown> | null;
  handoffError: string | null;
  body: string;
}

export function statusRepairMessage(text: string, error: string | null): string {
  const first = text.split(/\r?\n/).find(line => line.trim());
  const quoted = first === undefined ? "(empty report)" : JSON.stringify(first.length > 200 ? first.slice(0, 200) + "…" : first);
  return "Your report has no unambiguous status. First nonblank line: " + quoted +
    (error ? "\n" + error : "") +
    "\nRepost with `done`, `blocked`, `needs-input`, `waiting` or `checkpoint` as the first word, followed by the handoff. If the handoff also has `status:`, it must agree.";
}

// Some roles report only their phase-specific handoff.
const keySet = new Set<string>([...HANDOFF_KEYS, "status", "children", "respec", "landingRepair", "data"]);
const fencePattern = /^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(json|yaml|yml)[ \t]*\r?\n([\s\S]*?)^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(?=\r?$)/gim;

function firstStatus(text: string, structuredStatuses: unknown[]): { status: Status | null; error: string | null } {
  const lines = text.split(/\r?\n/);
  const statusAt = (line: string): Status | null => {
    const token = line.trim().replace(/^[*_]+/, "");
    const match = /^(done|blocked|needs-input|checkpoint|waiting)(?=$|[\s*_`:#—–.!?,;])/i.exec(token);
    return match ? match[1].toLowerCase() as Status : null;
  };
  const nonblank = lines.filter(line => line.trim());
  const candidates: Status[] = [];
  if (nonblank.length) {
    const leading = statusAt(nonblank[0]);
    if (leading) candidates.push(leading);
  }
  // Preserve the existing short-heading tolerance for a sentinel followed by prose.
  if (nonblank.length > 1 && (/^#{1,6}\s+/.test(nonblank[0].trim()) ||
    /^(?:report|final report|worker report|result|status)\s*:?$/i.test(nonblank[0].trim()) ||
    /:$/.test(nonblank[0].trim()))) {
    const afterHeading = statusAt(nonblank[1]);
    if (afterHeading) candidates.push(afterHeading);
  }
  // Later standalone sentinels are bare words; headings and list items are prose.
  for (const line of lines) {
    const candidate = statusAt(line);
    if (candidate && line.trim().toLowerCase() === candidate) {
      candidates.push(candidate);
    }
  }
  for (const handedOff of structuredStatuses) {
    if (typeof handedOff === "string" && ["done", "blocked", "needs-input", "checkpoint", "waiting"].includes(handedOff.toLowerCase())) {
      candidates.push(handedOff.toLowerCase() as Status);
    }
  }
  const unique = [...new Set(candidates)];
  return unique.length > 1
    ? { status: null, error: `conflicting report statuses: ${unique.join(", ")}` }
    : { status: unique[0] ?? null, error: null };
}

type HandoffBlock = { value: Record<string, unknown>; start: number; end: number } | { error: string };

function* handoffBlocks(text: string): Generator<HandoffBlock> {
  fencePattern.lastIndex = 0;
  for (const match of text.matchAll(fencePattern)) {
    const fence = match[2];
    const closing = match[6];
    if (fence[0] !== closing[0] || closing.length < fence.length) continue;

    let value: unknown;
    try {
      if (match[3].toLowerCase() === "json") value = JSON.parse(match[4]);
      else {
        const document = parseDocument(match[4]);
        if (document.errors.length) throw document.errors[0];
        value = document.toJS();
      }
    } catch (error) {
      yield { error: error instanceof Error ? error.message : String(error) };
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (!Object.keys(record).some(key => keySet.has(key))) continue;

    const start = match.index ?? 0;
    let end = start + match[0].length;
    if (text.slice(end).startsWith("\r\n")) end += 2;
    else if (text[end] === "\n") end++;
    yield { value: record, start, end };
  }
}

export function parse(text: string, cwd?: string): Report {
  const results = [...handoffBlocks(text)];
  const blocks = results.filter(result => "value" in result);
  const block = blocks.at(-1);
  const body = block ? text.slice(0, block.start) + text.slice(block.end) : text;
  // Keep the last payload, but check every handoff's status. Fence placeholders
  // prevent a scalar or later prose from becoming a first-word sentinel.
  let statusText = "", end = 0;
  for (const block of blocks) {
    statusText += text.slice(end, block.start) + "```\n";
    end = block.end;
  }
  const parsedStatus = firstStatus(statusText + text.slice(end), blocks.map(block => block.value.status));
  return {
    status: parsedStatus.status,
    handoff: block?.value ?? null,
    handoffError: results.find(result => "error" in result)?.error ?? parsedStatus.error ??
      (cwd && block ? commitHandoffError(cwd, block.value, text) ?? null : null),
    body,
  };
}
