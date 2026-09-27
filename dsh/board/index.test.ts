import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from './index';
import { read as readBoard, send as writeBoard } from '../../lib/board/store';
import type { Context } from '@deepseek-ai/cordis';

test('board host queues, retracts, and persists shared messages', async () => {
const oldDir = process.env.PI_BOARD_DIR;
const oldTopic = process.env.PI_BOARD_TOPIC;
const dir = mkdtempSync(join(tmpdir(), 'dsh-board-smoke-'));
process.env.PI_BOARD_DIR = dir;
process.env.PI_BOARD_TOPIC = 'smoke/lifecycle';

const handlers = new Map<string, (...args: any[]) => any>();
const tools = new Map<string, any>();
const agents: any[] = [];
const states = new Map<any, any>();
const cleanups: Array<() => void> = [];
let projection: any;
const ctx: any = {
  on(name: string, listener: (...args: any[]) => any) { handlers.set(name, listener); },
  effect(callback: () => (() => void) | void) { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
  sessionProjections: {
    register(definition: any) { projection = definition; return () => {}; },
    stateOf(session: any, key: string) {
      assert.equal(key, 'board');
      if (!states.has(session)) {
        let state = projection.init();
        for (const event of session.events) state = projection.apply(state, event);
        states.set(session, state);
      }
      return states.get(session);
    },
  },
  sessions: { async flush() { return true; } },
  agents: {
    list() { return agents; },
    get(id: string) { return agents.find((agent) => agent.id === id); },
  },
  tools: { register(tool: any) { tools.set(tool.name, tool); } },
  logger() { return { warn(message: string) { console.warn(message); } }; },
};
apply(ctx as Context);

function makeAgent(id: string): any {
  const session: any = {
    id,
    header: { cwd: dir },
    events: [],
    append(type: string, data: any, options?: any) {
      const event = { type, data };
      this.events.push(event);
      if (projection) states.set(this, projection.apply(ctx.sessionProjections.stateOf(this, 'board'), event));
      handlers.get('session/event')?.(this, event);
      (this.writes ??= []).push({ type, options });
    },
  };
  const inbox: any = {
    nextTurn: [],
    remove(id: string) { this.nextTurn = this.nextTurn.filter((message: any) => message.id !== id); },
    replace(id: string, message: any) {
      const index = this.nextTurn.findIndex((item: any) => item.id === id);
      if (index >= 0) this.nextTurn[index] = message;
    },
  };
  const agent: any = {
    id, session, inbox,
    followup(message: any) { inbox.nextTurn.push(message); },
  };
  agents.push(agent);
  return agent;
}

async function tool(name: string, args: any, agent: any): Promise<any> {
  return tools.get(name).execute(args, { agent });
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const sender = makeAgent('session-sender');
  const receiver = makeAgent('session-receiver');
  await handlers.get('agent/created')!({ agent: sender, source: 'startup' });
  await handlers.get('agent/created')!({ agent: receiver, source: 'startup' });
  await tool('board_subscribe', { topic: 'smoke/wake' }, receiver);
  await tool('board_send', { topic: 'smoke/wake', body: 'full read retracts' }, sender);
  await sleep(1_150);
  assert.equal(receiver.inbox.nextTurn.length, 1, 'matching wake is queued');
  assert.match(await tool('board_read', { topic: 'smoke/wake' }, receiver), /full read retracts/);
  assert.equal(receiver.inbox.nextTurn.length, 0, 'full read retracts the queued wake');

  const piMessage = writeBoard({ topic: 'smoke/wake', tags: [], from: { session: 'pi-side', name: 'pi' }, body: 'shared pi store' });
  await sleep(1_150);
  const shared = JSON.parse(await tool('board_read', { topic: 'smoke/wake' }, receiver));
  assert(shared.messages.some((message: any) => message.id === piMessage.id), 'dsh reads the shared pi store');
  assert.equal(receiver.inbox.nextTurn.length, 0, 'full shared-store read retracts its wake');
  await tool('board_send', { topic: 'smoke/wake', body: 'meta does not retract' }, sender);
  await sleep(1_150);
  assert.equal(receiver.inbox.nextTurn.length, 1, 'second matching wake is queued');
  const meta = JSON.parse(await tool('board_read', { topic: 'smoke/wake', fields: 'meta' }, receiver));
  assert.equal(receiver.inbox.nextTurn.length, 1, 'meta read does not acknowledge');
  await tool('board_ack', { ids: [meta.messages.at(-1).id] }, receiver);
  assert.equal(receiver.inbox.nextTurn.length, 0, 'explicit ack retracts the queued wake');

  const quiet = makeAgent('session-quiet');
  await handlers.get('agent/created')!({ agent: quiet, source: 'startup' });
  await tool('board_subscribe', { topic: 'smoke/quiet', wake: false }, quiet);
  await tool('board_send', { topic: 'smoke/quiet', body: 'quiet delivery at pre-step' }, sender);
  await sleep(1_150);
  assert.equal(quiet.inbox.nextTurn.length, 0, 'quiet subscription does not queue a wake');
  const preStep = await handlers.get('agent/pre-step')!({ agent: quiet, signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [] }));
  assert.match(preStep.messages[0].content[0].text, /quiet delivery at pre-step/);
  quiet.session.append('user/message', preStep.messages[0]);
  await sleep(20);
  assert(states.get(quiet.session).seen.includes(preStep.messages[0].source.boardMessageIds[0]), 'accepted notice is durably marked seen');

  handlers.get('session/event')!(receiver.session, { type: 'assistant/message', data: { turn: 4, message: { content: [{ type: 'text', text: 'READY' }] } } });
  handlers.get('session/event')!(receiver.session, { type: 'turn/end', data: { turn: 4, reason: { kind: 'stop' } } });
  handlers.get('agent/error')!({ agent: receiver, error: new Error('smoke crash') });
  handlers.get('agent/disposed')!({ agent: receiver });
  const reports = readBoard({ topic: 'smoke/lifecycle' }).messages;
  assert(reports.some((message) => message.body === 'READY'));
  assert(reports.some((message) => message.tags.includes('crashed')));
  assert(reports.some((message) => message.tags.includes('exited')));
  const customWrites = receiver.session.writes.filter((event: any) => event.type.startsWith('board/'));
  assert(customWrites.length > 0);
  assert(customWrites.every((event: any) => event.options?.ignorable === true), 'all board projection events are ignorable');
  let replayed = projection.init();
  for (const event of receiver.session.events) replayed = projection.apply(replayed, event);
  assert(replayed.seen.includes(meta.messages.at(-1).id));
} finally {
  for (const cleanup of cleanups) cleanup();
  rmSync(dir, { recursive: true, force: true });
  if (oldDir === undefined) delete process.env.PI_BOARD_DIR; else process.env.PI_BOARD_DIR = oldDir;
  if (oldTopic === undefined) delete process.env.PI_BOARD_TOPIC; else process.env.PI_BOARD_TOPIC = oldTopic;
}
});
