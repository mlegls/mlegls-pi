// Children's turn ends and follow-ups over the board: a child is a wm worker, named by its
// run/handle topic, or any session by session/<id>.
import * as wm from "./wm.ts";
import { readAll, send as post, type Message } from "./board/store";

export interface TurnEnd {
  id: string;
  kind: "finished" | "error" | "closed" | "permission";
  text: string;
  cursor: string;
  /** The host could not read this child at all; no later turn end will arrive until someone resumes it. */
  unreachable?: true;
}

export interface TurnEndOptions {
  after?: Record<string, string>;
  signal?: AbortSignal;
}

type EndKind = TurnEnd["kind"];

function terminalMessage(message: Message): EndKind | undefined {
  if (message.tags.includes("done") || message.tags.includes("blocked") || message.tags.includes("turn-end") ||
      message.tags.includes("needs-input") || message.tags.includes("checkpoint")) return "finished";
  return undefined;
}

function wmTarget(id: string): { run: string; handle: string; topic: string } {
  const slash = id.lastIndexOf("/");
  if (slash > 0 && slash < id.length - 1) {
    const run = id.slice(0, slash);
    const handle = id.slice(slash + 1);
    return { run, handle, topic: run + "/" + handle };
  }
  const boardTopic = process.env.PI_BOARD_TOPIC;
  const run = process.env.PI_WM_RUN || (boardTopic ? boardTopic.slice(0, boardTopic.lastIndexOf("/")) : "");
  if (!run) throw new Error("workmux child ID must be run/handle (or PI_WM_RUN must be set): " + id);
  return { run, handle: id, topic: run + "/" + id };
}

function lastWm(id: string): TurnEnd | null {
  const target = wmTarget(id);
  const message = readAll().reverse().find((item) => item.topic === target.topic && terminalMessage(item));
  if (!message) return null;
  return { id, kind: terminalMessage(message)!, text: message.body, cursor: message.id };
}

function wmKind(kind: wm.Outcome["kind"]): EndKind {
  return kind === "exited" ? "closed" : "finished";
}

function wmText(outcome: wm.Outcome): string {
  return "message" in outcome && outcome.message ? outcome.message.body : "tail" in outcome ? outcome.tail : "";
}

function wmCursor(outcome: wm.Outcome): string {
  return "message" in outcome && outcome.message ? outcome.message.id : "wm:" + outcome.kind + ":" + Date.now();
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Child wait aborted");
}

async function turnEndWm(ids: string[], options: TurnEndOptions): Promise<TurnEnd> {
  if (options.signal?.aborted) throw abortError(options.signal);
  const targets = ids.map((id) => ({ id, ...wmTarget(id) }));
  const existing = targets.map(({ id }) => lastWm(id)).filter((end): end is TurnEnd =>
    end !== null && (!options.after?.[end.id] || options.after[end.id] !== end.cursor));
  if (existing.length) return existing[0];

  const workers = targets.map((target) => wm.attach(target.run, target.handle));
  try {
    while (true) {
      if (options.signal?.aborted) throw abortError(options.signal);
      const events = await wm.wait(workers, { mode: "any", signal: options.signal });
      if (options.signal?.aborted) throw abortError(options.signal);
      for (const [worker, outcome] of events) {
        const id = targets.find((target) => target.topic === worker.topic)?.id ?? worker.handle;
        const end: TurnEnd = { id, kind: wmKind(outcome.kind), text: wmText(outcome), cursor: wmCursor(outcome) };
        if (!options.after?.[id] || options.after[id] !== end.cursor) return end;
      }
    }
  } finally {
    for (const worker of workers) worker.drop();
  }
}

/** Wait for the first child turn end after its cursor. IDs are workmux run/handle topics. */
export async function turnEnd(ids: string[], options: TurnEndOptions = {}): Promise<TurnEnd> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !id))
    throw new Error("children.turnEnd requires child IDs");
  return turnEndWm(ids, options);
}

/** Read a child's most recent terminal turn, useful when reattaching after a daemon restart. */
export async function last(id: string): Promise<TurnEnd | null> {
  return lastWm(id);
}

/** Send a follow-up: to a wm worker's pane, or for session/<id> a waking board message. */
export async function send(id: string, text: string): Promise<void> {
  if (typeof text !== "string") throw new Error("children.send requires text");
  if (id.startsWith("session/")) {
    post({ topic: id, tags: [], from: { name: process.env.PI_BOARD_NAME ?? "ab" }, body: text });
    return;
  }
  const target = wmTarget(id);
  const worker = wm.attach(target.run, target.handle);
  try { await worker.send(text); } finally { worker.drop(); }
}
