import type { PaseoAgent, PaseoAgentTimelineEvent } from "@getpaseo/client";
import { executionHost } from "./execution-host.ts";
import * as paseo from "./paseo.ts";
import * as wm from "./wm.ts";
import { readAll, type Message } from "./board/store";

export interface TurnEnd {
  id: string;
  kind: "finished" | "error" | "closed" | "permission";
  text: string;
  cursor: string;
}

export interface TurnEndOptions {
  after?: Record<string, string>;
  signal?: AbortSignal;
}

type EndKind = TurnEnd["kind"];
type Cursor = { epoch: string; seq: number };

function parseCursor(cursor: string | undefined): Cursor | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(cursor);
    if (typeof value?.epoch === "string" && Number.isFinite(value?.seq))
      return { epoch: value.epoch, seq: value.seq };
  } catch { /* workmux message IDs are not Paseo cursors */ }
  return undefined;
}

function cursorString(cursor: Cursor): string {
  return JSON.stringify(cursor);
}

function isAfter(cursor: Cursor | undefined, after: string | undefined): boolean {
  if (!after) return true;
  const previous = parseCursor(after);
  if (!previous || !cursor) return true;
  return cursor.epoch !== previous.epoch || cursor.seq > previous.seq;
}

function paseoId(id: string): string {
  return id.startsWith("paseo:") ? id.slice("paseo:".length) : id;
}

function isPaseoId(id: string): boolean {
  return id.startsWith("paseo:") || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function backendFor(id: string): "paseo" | "wm" {
  if (isPaseoId(id)) return "paseo";
  if (id.includes("/")) return "wm";
  return executionHost();
}

type TimelineEntry = { item: { type: string; text?: string }; seqEnd: number };

function latestAssistant(entries: TimelineEntry[]): TimelineEntry | undefined {
  for (let i = entries.length - 1; i >= 0; i--)
    if (entries[i].item.type === "assistant_message") return entries[i];
  return undefined;
}

function completedAssistant(entries: TimelineEntry[]): TimelineEntry | undefined {
  const assistant = latestAssistant(entries);
  if (!assistant) return undefined;
  let lastUserSeq = -1;
  for (const entry of entries) if (entry.item.type === "user_message") lastUserSeq = entry.seqEnd;
  return assistant.seqEnd > lastUserSeq ? assistant : undefined;
}

function textFromEntries(entries: TimelineEntry[]): string {
  return latestAssistant(entries)?.item.text ?? "";
}

function statusKind(agent: PaseoAgent | null, entries: TimelineEntry[]): EndKind | null {
  if (!agent) return null;
  if (agent.pendingPermissions?.length || agent.attentionReason === "permission") return "permission";
  if (agent.status === "closed") return "closed";
  if (agent.status === "error" || agent.attentionReason === "error") return "error";
  if ((agent.attentionReason === "finished" || agent.status === "idle" && !agent.activeTurn) && completedAssistant(entries))
    return "finished";
  return null;
}


function pageCursor(page: { endCursor: Cursor | null; epoch: string; window: { maxSeq: number } }): Cursor {
  return page.endCursor ?? { epoch: page.epoch, seq: page.window.maxSeq };
}

async function readPaseoEnd(client: Awaited<ReturnType<typeof paseo.connect>>, id: string): Promise<TurnEnd | null> {
  const handle = client.agents.ref(paseoId(id));
  const page = await handle.timeline.refetch({ direction: "tail", limit: 100, projection: "canonical" });
  if (page.error) throw new Error("Paseo timeline " + id + ": " + page.error);
  const text = textFromEntries(page.entries);
  const kind = statusKind(page.agent ?? handle.current(), page.entries);
  if (!kind) return null;
  return { id, kind, text, cursor: cursorString(pageCursor(page)) };
}

function streamEndKind(event: PaseoAgentTimelineEvent["event"]): EndKind | null {
  switch (event.type) {
    case "turn_completed": return "finished";
    case "turn_failed": return "error";
    case "turn_canceled": return "closed";
    case "permission_requested": return "permission";
    case "attention_required":
      return event.reason === "permission" ? "permission" : event.reason === "error" ? "error" : "finished";
    default: return null;
  }
}

function streamCursor(event: PaseoAgentTimelineEvent): Cursor | undefined {
  if ("generation" in event && "seq" in event && typeof event.generation === "string" && typeof event.seq === "number")
    return { epoch: event.generation, seq: event.seq };
  return undefined;
}

interface AgentWait {
  promise: Promise<TurnEnd>;
  stop(): Promise<void>;
}

function watchPaseoAgent(client: Awaited<ReturnType<typeof paseo.connect>>, id: string, after: string | undefined): AgentWait {
  const agentId = paseoId(id);
  const handle = client.agents.ref(agentId);
  let resolve!: (value: TurnEnd) => void;
  let reject!: (reason: unknown) => void;
  let settled = false;
  let lastText = "";
  const promise = new Promise<TurnEnd>((res, rej) => { resolve = res; reject = rej; });
  const finish = (value: TurnEnd) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };
  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    reject(error);
  };

  const check = async (preferred?: EndKind, eventCursor?: Cursor, eventIsLive = false) => {
    if (settled) return;
    try {
      const page = await handle.timeline.refetch({ direction: "tail", limit: 100, projection: "canonical" });
      if (page.error) throw new Error("Paseo timeline " + id + ": " + page.error);
      const assistant = completedAssistant(page.entries);
      lastText = textFromEntries(page.entries) || lastText;
      const snapshot = page.agent ?? handle.current();
      const kind = preferred ?? statusKind(snapshot, page.entries);
      if (!kind || kind === "finished" && !assistant) return;
      const cursor = eventCursor ?? pageCursor(page);
      if (kind === "finished" && assistant && !isAfter({ epoch: page.epoch, seq: assistant.seqEnd }, after)) return;
      if (!isAfter(cursor, after) && !eventIsLive) return;
      if (eventCursor && !isAfter(eventCursor, after)) return;
      finish({ id, kind, text: lastText, cursor: cursorString(cursor) });
    } catch (error) { fail(error); }
  };

  const timeline = handle.timeline.subscribe((event) => {
    if (event.agentId !== agentId) return;
    if (event.event.type === "error") {
      fail(new Error("Paseo timeline " + id + ": " + event.event.error));
      return;
    }
    if (event.event.type === "replacement" || event.event.type === "subscription_restored") {
      void check();
      return;
    }
    const kind = streamEndKind(event.event);
    if (kind) void check(kind, streamCursor(event), true);
  });
  const unsubscribeAgent = handle.subscribe((update) => {
    if (update.kind === "remove" && update.agentId === agentId) {
      const cursor = update.generation && typeof update.seq === "number"
        ? { epoch: update.generation, seq: update.seq } : undefined;
      void check("closed", cursor, true);
    } else if (update.kind === "upsert" && update.agent.id === agentId) {
      const cursor = update.generation && typeof update.seq === "number"
        ? { epoch: update.generation, seq: update.seq } : undefined;
      void check(undefined, cursor, true);
    }
  });
  void timeline.ready.then(() => check()).catch(fail);

  return {
    promise,
    async stop() {
      unsubscribeAgent();
      await timeline.release().catch(() => {});
    },
  };
}

function terminalMessage(message: Message): EndKind | undefined {
  if (message.tags.includes("done") || message.tags.includes("blocked") ||
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
  return "message" in outcome ? outcome.message.body : outcome.tail;
}

function wmCursor(outcome: wm.Outcome): string {
  return "message" in outcome ? outcome.message.id : "wm:" + outcome.kind + ":" + Date.now();
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

/** Wait for the first child turn end after its cursor. IDs are Paseo agent IDs or workmux run/handle topics. */
export async function turnEnd(ids: string[], options: TurnEndOptions = {}): Promise<TurnEnd> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !id))
    throw new Error("children.turnEnd requires child IDs");
  if (options.signal?.aborted) throw abortError(options.signal);
  const hosts = new Set(ids.map(backendFor));
  if (hosts.size !== 1) throw new Error("children.turnEnd cannot wait across execution hosts");
  const host = [...hosts][0];
  if (host === "wm") return turnEndWm(ids, options);

  const client = await paseo.connect({ reconnect: { enabled: true } });
  if (options.signal?.aborted) { await client.close(); throw abortError(options.signal); }
  const waits = ids.map((id) => watchPaseoAgent(client, id, options.after?.[id]));
  const signal = options.signal;
  let abortListener: (() => void) | undefined;
  try {
    const races: Array<Promise<TurnEnd>> = waits.map((wait) => wait.promise);
    if (signal) races.push(new Promise<TurnEnd>((_resolve, reject) => {
      abortListener = () => reject(abortError(signal));
      signal.addEventListener("abort", abortListener, { once: true });
    }));
    return await Promise.race(races);
  } finally {
    if (signal && abortListener) signal.removeEventListener("abort", abortListener);
    await Promise.all(waits.map((wait) => wait.stop()));
    await client.close();
  }
}

/** Read a child's most recent terminal turn, useful when reattaching after a daemon restart. */
export async function last(id: string): Promise<TurnEnd | null> {
  const host = backendFor(id);
  if (host === "wm") return lastWm(id);
  return paseo.withClient((client) => readPaseoEnd(client, id));
}

/** Send a follow-up to a child using its execution host. */
export async function send(id: string, text: string): Promise<void> {
  if (typeof text !== "string") throw new Error("children.send requires text");
  const host = backendFor(id);
  if (host === "wm") {
    const target = wmTarget(id);
    const worker = wm.attach(target.run, target.handle);
    try { await worker.send(text); } finally { worker.drop(); }
    return;
  }
  await paseo.withClient(async (client) => client.agents.ref(paseoId(id)).send(text));
}
