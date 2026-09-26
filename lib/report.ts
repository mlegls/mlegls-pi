import { parseDocument } from "yaml";

export const HANDOFF_KEYS = ["commit", "setup", "stories", "evidence", "caveats", "question"] as const;

type Status = "done" | "blocked" | "needs-input";
export interface Report {
  status: Status | null;
  handoff: Record<string, unknown> | null;
  body: string;
}

const keySet = new Set<string>(HANDOFF_KEYS);
const fencePattern = /^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(json|yaml|yml)[ \t]*\r?\n([\s\S]*?)^([ \t]{0,3})(`{3,}|~{3,})[ \t]*(?=\r?$)/gim;

function firstStatus(text: string): Status | null {
  const lines = text.split(/\r?\n/);
  const nonblank = lines.filter(line => line.trim());
  const statusAt = (line: string): Status | null => {
    const token = line.trim().replace(/^(?:(?:>+\s*)|(?:#{1,6}\s*)|(?:[-+*]\s+)|(?:\*\*|__|\*|_))*/, "");
    const match = /^(done|blocked|needs-input)(?=$|[\s*_`:#—–.!?,;])/i.exec(token);
    return match ? match[1].toLowerCase() as Status : null;
  };
  if (!nonblank.length) return null;
  const first = statusAt(nonblank[0]);
  if (first) return first;

  // A short title/label before the sentinel is harmless; don't scan further into prose.
  const preamble = nonblank[0].trim();
  const isPreamble = /^#{1,6}\s+/.test(preamble) ||
    /^(?:report|final report|worker report|result|status)\s*:?$/i.test(preamble) || /:$/.test(preamble);
  return isPreamble && nonblank.length > 1 ? statusAt(nonblank[1]) : null;
}

function handoffBlock(text: string): { value: Record<string, unknown>; start: number; end: number } | null {
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
        if (document.errors.length) continue;
        value = document.toJS();
      }
    } catch {
      continue;
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
  const block = handoffBlock(text);
  return {
    status: firstStatus(text),
    handoff: block?.value ?? null,
    body: block ? text.slice(0, block.start) + text.slice(block.end) : text,
  };
}
