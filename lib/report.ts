import { parseDocument } from "yaml";

export const HANDOFF_KEYS = ["commit", "setup", "stories", "evidence", "caveats", "question"] as const;

type Status = "done" | "blocked" | "needs-input" | "checkpoint";
export interface Report {
  status: Status | null;
  handoff: Record<string, unknown> | null;
  handoffError: string | null;
  body: string;
}

const keySet = new Set<string>([...HANDOFF_KEYS, "status"]);
const fencePattern = /^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(json|yaml|yml)[ \t]*\r?\n([\s\S]*?)^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(?=\r?$)/gim;

function firstStatus(text: string, handoff: Record<string, unknown> | null): { status: Status | null; error: string | null } {
  const lines = text.split(/\r?\n/);
  const statusAt = (line: string): Status | null => {
    const token = line.trim().replace(/^(?:(?:>+\s*)|(?:#{1,6}\s*)|(?:[-+*]\s+)|(?:\*\*|__|\*|_))*/, "");
    const match = /^(done|blocked|needs-input|checkpoint)(?=$|[\s*_`:#—–.!?,;])/i.exec(token);
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
  for (const line of lines) {
    const candidate = statusAt(line);
    if (candidate && line.trim().replace(/^(?:(?:>+\s*)|(?:#{1,6}\s*)|(?:[-+*]\s+)|(?:\*\*|__|\*|_))*/, "").trim().toLowerCase() === candidate) {
      candidates.push(candidate);
    }
  }
  const handedOff = handoff?.status;
  if (typeof handedOff === "string" && ["done", "blocked", "needs-input", "checkpoint"].includes(handedOff.toLowerCase())) {
    candidates.push(handedOff.toLowerCase() as Status);
  }
  const unique = [...new Set(candidates)];
  return unique.length > 1
    ? { status: null, error: `conflicting report statuses: ${unique.join(", ")}` }
    : { status: unique[0] ?? null, error: null };
}

type HandoffBlock = { value: Record<string, unknown>; start: number; end: number } | { error: string };

function handoffBlock(text: string): HandoffBlock | null {
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
        if (document.errors.length) return { error: document.errors.map(error => error.message).join("; ") };
        value = document.toJS();
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (!Object.keys(record).some(key => keySet.has(key))) continue;

    const start = match.index ?? 0;
    let end = start + match[0].length;
    if (text.slice(end).startsWith("\r\n")) end += 2;
    else if (text[end] === "\n") end++;
    return { value: record, start, end };
  }
  return null;
}

export function parse(text: string): Report {
  const result = handoffBlock(text);
  const block = result && "value" in result ? result : null;
  const body = block ? text.slice(0, block.start) + text.slice(block.end) : text;
  // Keep a non-status placeholder so removing a leading handoff cannot promote
  // later prose to the message's first word; its scalar values aren't sentinels.
  const statusText = block ? text.slice(0, block.start) + "```\n" + text.slice(block.end) : text;
  const parsedStatus = firstStatus(statusText, block?.value ?? null);
  return {
    status: parsedStatus.status,
    handoff: block?.value ?? null,
    handoffError: result && "error" in result ? result.error : parsedStatus.error,
    body,
  };
}
