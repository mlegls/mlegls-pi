import { basename } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Context } from '@deepseek-ai/cordis';
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-session-projection';
import type {} from '@deepseek-ai/dsh-session-projection/types';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import { z } from 'zod';
import { compileQuery, parseTags } from '../../lib/board/query';
import { logSize, meta, noteRead, read, readFrom, send, topics, type Message } from '../../lib/board/store';
import { mailbox } from '../../lib/board/mailbox';
import { scopes } from '../../lib/board/scopes';
import { parse } from '../../lib/report';

interface Subscription { topic: string; tags?: string; wake: boolean }
interface CursorEntry { offset: number; pending: Message[] }
interface BoardState { subscriptions: Subscription[] | null; offset: number | null; pending: Message[]; seen: string[] }
interface BoardNoticeSource { kind: 'board'; form: 'notice'; summary: string; boardMessageIds: string[] }

const SUBS = 'board/subscriptions';
const CURSOR = 'board/cursor';
const SEEN = 'board/seen';
const POLL_MS = 1_000;
const emptyState = (): BoardState => ({ subscriptions: null, offset: null, pending: [], seen: [] });
const messageSchema = z.object({
  id: z.string(), ts: z.string(), topic: z.string(), tags: z.array(z.string()),
  from: z.object({ session: z.string().optional(), name: z.string().optional(), cwd: z.string().optional() }).strict(),
  body: z.string(), data: z.unknown().optional(),
}).strict();
const stateSchema = z.object({
  subscriptions: z.array(z.object({ topic: z.string(), tags: z.string().optional(), wake: z.boolean() }).strict()).nullable(),
  offset: z.number().int().nonnegative().nullable(),
  pending: z.array(messageSchema),
  seen: z.array(z.string()),
}).strict();

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'board/subscriptions': { subscriptions: Subscription[] };
    'board/cursor': CursorEntry;
    'board/seen': { ids: string[] };
  }
}
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap { board: BoardState }
}
declare module '@deepseek-ai/dsh-llm/types' {
  interface MessageSourceMap { board: BoardNoticeSource }
}

type BoardEvent = 'board/subscriptions' | 'board/cursor' | 'board/seen';
type BoardData = {
  'board/subscriptions': { subscriptions: Subscription[] };
  'board/cursor': CursorEntry;
  'board/seen': { ids: string[] };
};

const projection = {
  key: 'board' as const, stateVersion: 1, stateSchema, init: emptyState,
  apply(state: BoardState, event: SessionEvent): BoardState {
    if (event.type === SUBS) return { ...state, subscriptions: event.data.subscriptions };
    if (event.type === CURSOR) return { ...state, offset: event.data.offset, pending: event.data.pending };
    if (event.type === SEEN) return withSeen(state, event.data.ids);
    if (event.type === 'user/message' && event.data.source.kind === 'board') {
      return withSeen(state, event.data.source.boardMessageIds);
    }
    return state;
  },
};

function withSeen(state: BoardState, ids: readonly string[]): BoardState {
  const seen = new Set(state.seen);
  for (const id of ids) seen.add(id);
  if (seen.size === state.seen.length && state.pending.every((message) => !seen.has(message.id))) return state;
  return { ...state, seen: [...seen], pending: state.pending.filter((message) => !seen.has(message.id)) };
}

const dirtySessions = new WeakSet<Session>();
function append<T extends BoardEvent>(session: Session, type: T, data: BoardData[T]): void {
  // The pinned dsh-session build needs the companion patch to retain this marker.
  (session.append as unknown as (type: T, data: BoardData[T], options: { ignorable: true }) => unknown)(type, data, { ignorable: true });
  dirtySessions.add(session);
}

function cwd(agent: Agent): string { return agent.session.header.cwd || process.cwd(); }
function agentName(agent: Agent): string { return process.env.PI_BOARD_NAME ?? basename(cwd(agent)); }
function topic(agent: Agent): string { return process.env.PI_BOARD_TOPIC || mailbox(agent.id); }
function reader(agent: Agent) { return { session: agent.id, name: agentName(agent), cwd: cwd(agent) }; }
function runtime(agent: Agent): { last?: { turn: number; text: string } } {
  let value = runtimeStates.get(agent);
  if (!value) runtimeStates.set(agent, value = {});
  return value;
}
const runtimeStates = new WeakMap<Agent, { last?: { turn: number; text: string } }>();

function stateOf(ctx: Context, agent: Agent): BoardState {
  const state = ctx.sessionProjections.stateOf(agent.session, 'board') as BoardState | undefined;
  if (!state) throw new Error(`board projection missing for session ${agent.id}`);
  return state;
}
function subKey(sub: Subscription): string { return `${sub.topic} :: ${sub.tags ?? ''}`; }
function defaultSubs(agent: Agent): Subscription[] {
  const paths = [process.env.PI_BOARD_TOPIC, mailbox(agent.id), ...scopes(cwd(agent))].filter((value): value is string => !!value);
  return [...new Map(paths.map((path) => [path, { topic: path, wake: true }])).values()];
}
function subscriptions(ctx: Context, agent: Agent): Subscription[] {
  return stateOf(ctx, agent).subscriptions ?? defaultSubs(agent);
}
function matches(message: Message, subs: readonly Subscription[]): boolean {
  return subs.some((sub) => compileQuery(sub)(message.topic, message.tags));
}
function validMessage(value: unknown): value is Message {
  return messageSchema.safeParse(value).success;
}
async function flush(ctx: Context, agent: Agent): Promise<void> {
  if (!await ctx.sessions.flush(agent.session)) throw new Error(`no session persistence listener for ${agent.id}`);
  dirtySessions.delete(agent.session);
}
function collect(ctx: Context, agent: Agent): boolean {
  const state = stateOf(ctx, agent);
  const result = readFrom(state.offset ?? logSize());
  if (result.offset === state.offset) return false;
  const seen = new Set(state.seen);
  const pending = new Map(state.pending.map((message) => [message.id, message]));
  for (const message of result.messages) {
    if (!validMessage(message) || message.from.session === agent.id || seen.has(message.id)) continue;
    if (matches(message, subscriptions(ctx, agent))) pending.set(message.id, message);
  }
  append(agent.session, CURSOR, { offset: result.offset, pending: [...pending.values()] });
  return true;
}
function pendingFor(ctx: Context, agent: Agent, wakingOnly = false): Message[] {
  const state = stateOf(ctx, agent);
  const subs = subscriptions(ctx, agent);
  const seen = new Set(state.seen);
  return state.pending.filter((message) => !seen.has(message.id) && subs.some((sub) =>
    (!wakingOnly || sub.wake) && compileQuery(sub)(message.topic, message.tags)));
}
function format(message: Message): string {
  const tags = message.tags.length ? ` [${message.tags.join(' ')}]` : '';
  const from = message.from.name ? ` <${message.from.name}>` : '';
  const data = message.data === undefined ? '' : `\n${JSON.stringify(message.data)}`;
  return `${message.id} ${message.ts.slice(11, 19)} ${message.topic}${tags}${from}\n${message.body}${data}`;
}
function notice(messages: readonly Message[]): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: messages.map((message) => `[board] ${format(message)}`).join('\n\n') }],
    source: {
      kind: 'board', form: 'notice', summary: boundContextSummary('New board messages'),
      boardMessageIds: messages.map((message) => message.id),
    },
  });
}
function isNotice(message: UserMessage): message is UserMessage & { source: BoardNoticeSource } {
  const source = message.source as Partial<BoardNoticeSource>;
  return source.kind === 'board' && source.form === 'notice' && Array.isArray(source.boardMessageIds);
}
function reconcileInbox(ctx: Context, agent: Agent): boolean {
  let changed = false;
  const state = stateOf(ctx, agent);
  const seen = new Set(state.seen);
  const active = state.pending.filter((message) => !seen.has(message.id) && matches(message, subscriptions(ctx, agent)));
  if (active.length !== state.pending.length) {
    append(agent.session, CURSOR, { offset: state.offset ?? logSize(), pending: active });
    changed = true;
  }
  const available = new Map(pendingFor(ctx, agent, true).map((message) => [message.id, message]));
  const queued = agent.inbox.nextTurn.filter(isNotice);
  for (const old of queued) {
    const selected = old.source.boardMessageIds.flatMap((id) => {
      const message = available.get(id);
      if (!message) return [];
      available.delete(id);
      return [message];
    });
    if (!selected.length) { agent.inbox.remove(old.id); changed = true; }
    else if (selected.length !== old.source.boardMessageIds.length) { agent.inbox.replace(old.id, notice(selected)); changed = true; }
  }
  if (available.size) {
    const existing = agent.inbox.nextTurn.find(isNotice);
    const messages = [...available.values()];
    if (!existing) agent.followup(notice(messages));
    else {
      const combined = [...existing.source.boardMessageIds.flatMap((id) => {
        const message = stateOf(ctx, agent).pending.find((item) => item.id === id);
        return message ? [message] : [];
      }), ...messages];
      agent.inbox.replace(existing.id, notice(combined));
    }
    changed = true;
  }
  if (changed) dirtySessions.add(agent.session);
  return changed;
}
async function acknowledge(ctx: Context, agent: Agent, ids: readonly string[]): Promise<string[]> {
  const seen = new Set(stateOf(ctx, agent).seen);
  const fresh = [...new Set(ids)].filter((id) => !seen.has(id));
  if (fresh.length) {
    append(agent.session, SEEN, { ids: fresh });
    noteRead({ action: 'ack', reader: reader(agent), ids: fresh });
  }
  reconcileInbox(ctx, agent);
  dirtySessions.add(agent.session);
  await flush(ctx, agent);
  return fresh;
}
async function initialize(ctx: Context, agent: Agent): Promise<void> {
  let state = stateOf(ctx, agent);
  if (state.subscriptions === null) {
    append(agent.session, SUBS, { subscriptions: defaultSubs(agent) });
    state = stateOf(ctx, agent);
  }
  if (state.offset === null) append(agent.session, CURSOR, { offset: logSize(), pending: state.pending });
  reconcileInbox(ctx, agent);
  await flush(ctx, agent);
}
async function subscribe(ctx: Context, agent: Agent, args: { topic: string; tags?: string; wake?: boolean; remove?: boolean }): Promise<Subscription[]> {
  parseTags(args.tags);
  const old = subscriptions(ctx, agent);
  const sub: Subscription = {
    topic: args.topic,
    ...(args.tags ? { tags: args.tags } : {}),
    wake: args.wake ?? true,
  };
  const next = old.filter((item) => subKey(item) !== subKey(sub));
  if (!args.remove) next.push(sub);
  append(agent.session, SUBS, { subscriptions: next });
  reconcileInbox(ctx, agent);
  await flush(ctx, agent);
  return next;
}
function report(ctx: Context, agent: Agent, tags: string[], body: string, data: unknown): void {
  try { send({ topic: topic(agent), tags, from: reader(agent), body, data }); }
  catch (error) { ctx.logger('board').warn(`board lifecycle publish failed for ${agent.id}: ${String(error)}`); }
}
function textContent(content: readonly { type: string; text?: string }[]): string {
  return content.filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text!).join('\n');
}
function installTools(ctx: Context): void {
  const output = { schema: { type: 'string' as const }, render: (_args: unknown, text: string) => [{ type: 'text' as const, text }] };
  ctx.tools.register(defineTool({
    name: 'board_send',
    description: 'Publish to the shared pi/dsh board. Tags classify messages; use kind:decision and path:<file> tags for decisions.',
    parameters: {
      topic: { type: 'string', required: true, description: 'Topic path.' }, body: { type: 'string', required: true },
      tags: { type: 'array', items: { type: 'string' }, description: 'Literal classification tags.' },
      data: { type: 'json', description: 'Optional structured payload.' },
    }, output,
    async execute({ topic: to, body, tags, data }, exec) {
      if (!exec.agent) throw new Error('board tools require an agent');
      const message = send({ topic: to, body, tags: tags ?? [], data, from: reader(exec.agent) });
      return `sent ${message.id} → ${message.topic}`;
    },
  }));
  ctx.tools.register(defineTool({
    name: 'board_read',
    description: 'Read board messages by topic and tag expression. Full reads acknowledge returned messages and cancel their queued wakes; meta reads do not acknowledge.',
    parameters: {
      topic: { type: 'string', description: 'Topic glob; default **.' },
      tags: { type: 'string', description: 'Tag expression: !, &, |; comma means AND.' },
      limit: { type: 'integer', description: 'Newest matches; default 20.' },
      fields: { type: 'string', enum: ['full', 'meta'], description: 'meta omits data and truncates bodies.' },
      bodyChars: { type: 'integer', description: 'Meta body limit, default 120; 0 omits it.' },
    }, output,
    async execute(args, exec) {
      if (!exec.agent) throw new Error('board tools require an agent');
      parseTags(args.tags);
      const result = read({ topic: args.topic, tags: args.tags, limit: args.limit });
      if (result.messages.length) noteRead({ action: 'read', reader: reader(exec.agent), topic: args.topic, tags: args.tags, count: result.messages.length });
      const messages = args.fields === 'meta' ? result.messages.map((message) => meta(message, args.bodyChars ?? 120)) : result.messages;
      if (args.fields !== 'meta' && result.messages.length) await acknowledge(ctx, exec.agent, result.messages.map((message) => message.id));
      return JSON.stringify({ messages, omitted: result.omitted, total: result.total });
    },
  }));
  ctx.tools.register(defineTool({
    name: 'board_list', description: 'List board topics and this session’s subscriptions.',
    parameters: { topic: { type: 'string', description: 'Optional topic glob.' } }, output,
    async execute({ topic: pattern }, exec) {
      if (!exec.agent) throw new Error('board tools require an agent');
      return JSON.stringify({ topics: topics(pattern), subscriptions: subscriptions(ctx, exec.agent) });
    },
  }));
  ctx.tools.register(defineTool({
    name: 'board_subscribe', description: 'Subscribe to a topic glob × tag expression. wake defaults true; remove drops the exact topic × tags. Persists across resume.',
    parameters: {
      topic: { type: 'string', required: true, description: 'Topic glob.' }, tags: { type: 'string', description: 'Tag expression.' },
      wake: { type: 'boolean', description: 'Start a follow-up on match; default true.' }, remove: { type: 'boolean' },
    }, output,
    async execute(args, exec) {
      if (!exec.agent) throw new Error('board tools require an agent');
      const active = await subscribe(ctx, exec.agent, args);
      const sub: Subscription = { topic: args.topic, tags: args.tags || undefined, wake: args.wake ?? true };
      return `${args.remove ? 'unsubscribed' : 'subscribed'} ${sub.wake ? 'wake' : 'quiet'} ${subKey(sub)}\n${active.length} active`;
    },
  }));
  ctx.tools.register(defineTool({
    name: 'board_ack', description: 'Acknowledge selected board message IDs, suppressing pending delivery and wake.',
    parameters: { ids: { type: 'array', items: { type: 'string' }, required: true } }, output,
    async execute({ ids }, exec) {
      if (!exec.agent) throw new Error('board tools require an agent');
      return JSON.stringify({ acknowledged: await acknowledge(ctx, exec.agent, ids) });
    },
  }));
}

export const name = 'board';
export const inject = ['agents', 'sessionProjections', 'sessionPersistence', 'sessions', 'tools'];

export function apply(ctx: Context): void {
  ctx.sessionProjections.register(projection);
  ctx.on('agent/created', async ({ agent, source }) => {
    await initialize(ctx, agent);
    report(ctx, agent, ['started'], `started (${source})`, { event: 'started', source, session: agent.id });
    return undefined;
  });
  ctx.on('agent/disposed', ({ agent }) => report(ctx, agent, ['exited'], `exited ${agent.id}`, { event: 'exited', session: agent.id }));
  ctx.on('agent/error', ({ agent, error }) => {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    report(ctx, agent, ['crashed'], detail, { event: 'crashed', session: agent.id, error: detail });
  });
  ctx.on('session/event', (session, event) => {
    const agent = ctx.agents.get(session.id);
    if (!agent) return;
    const live = runtime(agent);
    if (event.type === 'assistant/message') live.last = { turn: event.data.turn, text: textContent(event.data.message.content) };
    else if (event.type === 'turn/end') {
      const text = live.last?.turn === event.data.turn ? live.last.text : '';
      const status = text ? parse(text).status : undefined;
      report(ctx, agent, ['turn-end', ...(status ? [status] : [])], text || `turn ${event.data.turn} ended (${event.data.reason.kind})`, {
        event: 'turn-end', turn: event.data.turn, reason: event.data.reason,
      });
      live.last = undefined;
    } else if (event.type === 'user/message' && event.data.source.kind === 'board') {
      const ids = event.data.source.boardMessageIds;
      queueMicrotask(() => {
        void acknowledge(ctx, agent, ids).catch((error) => ctx.logger('board').warn(`board acknowledgement failed for ${agent.id}: ${String(error)}`));
      });
    }
  });
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    const decision = await next();
    if (decision.kind !== 'enter' || signal.aborted) return decision;
    if (collect(ctx, agent)) await flush(ctx, agent);
    const included = new Set(decision.messages.filter(isNotice).flatMap((message) => message.source.boardMessageIds));
    const extra = pendingFor(ctx, agent).filter((message) => !included.has(message.id));
    return extra.length ? { ...decision, messages: [...decision.messages, notice(extra)] } : decision;
  });
  installTools(ctx);
  ctx.effect(() => {
    const polling = new WeakSet<Agent>();
    const poll = async () => {
      for (const agent of ctx.agents.list()) {
        if (polling.has(agent)) continue;
        polling.add(agent);
        try {
          const collected = collect(ctx, agent);
          const queued = reconcileInbox(ctx, agent);
          if (collected || queued || dirtySessions.has(agent.session)) await flush(ctx, agent);
        } catch (error) { ctx.logger('board').warn(`board poll failed for ${agent.id}: ${String(error)}`); }
        finally { polling.delete(agent); }
      }
    };
    const timer = setInterval(() => { void poll(); }, POLL_MS);
    timer.unref?.();
    return () => clearInterval(timer);
  }, 'board.poller');
  for (const agent of ctx.agents.list()) {
    void initialize(ctx, agent).then(() => report(ctx, agent, ['started'], 'attached to board host', { event: 'started', session: agent.id }))
      .catch((error) => ctx.logger('board').warn(`board initialization failed for ${agent.id}: ${String(error)}`));
  }
}

export default { name, inject, apply };
