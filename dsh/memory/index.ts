import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction';
import { BlockAssembler } from '@deepseek-ai/dsh-llm';
import { isDeepStrictEqual } from 'node:util';
import type {} from '@deepseek-ai/dsh-token-meter';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionSeq } from '@deepseek-ai/dsh-session';

import { instruction, splitCheckpoint, parseBlock, roughTokens, type Block } from '../../extensions/memory/core';
declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'memory/checkpoint': { version: 1; checkpointSeq: SessionSeq; blocks: Block[]; register: string;
      selfAuthored: boolean; operation: string; tail: string };
  }
}

const REGISTER = 'compaction-om-v10';
const BLOCKED = /reverse engineering|duplicating model outputs/i;
const RECORD = 'memory/checkpoint';
const textOf = (m: any) => typeof m.content === 'string' ? m.content :
  (m.content ?? []).map((b: any) => b.type === 'text' ? b.text : b.type === 'tool-call' ? JSON.stringify(b) : '').join('\n');
const render = (blocks: Block[]) => blocks.map(b =>
  `Historical memory ${b.id}. Recall [@SESSION:SEQ] with tools.session_event_read({session_id: SESSION, seq: SEQ}) inside run_code for the full original event. Explicit corrections replace only the described earlier statements.\n${b.text}`).join('\n\n');

/** Native pressure/overflow policy and transaction writer; only checkpoint production changes. */
export default class MemoryCompaction extends BasicCompactionEngine {
  private prepared = new WeakMap<object, any>();

  override async summarize(input: any, agent: Agent, signal?: AbortSignal) {
    return this.prepared.get(agent) ?? super.summarize(input, agent, signal);
  }

  override async compactRegion(start: SessionSeq, end: SessionSeq, agent: Agent, signal?: AbortSignal) {
    const session = agent.session;
    const events = session.snapshotEvents();
    const nodes = [...session.surface.nodes];
    const startIndex = nodes.indexOf(start);
    if (startIndex < 0) throw new Error('Memory start is not on the surface');
    const measurement = this.ctx.tokenMeter.measure(session);
    const messages = nodes.map(seq => session.deriveEventMessage(events[seq]));
    const sessionId = session.id.startsWith('session-') ? session.id : `session-${session.id}`;
    const id = (seq: number) => `${sessionId}:${seq}`;
    // Only records whose replacement is still visible apply. Forks inherit both exactly.
    const prior: Block[] = [];
    const checkpointSeqs = new Set<number>();
    for (const event of events) {
      if (event.type === RECORD && nodes.includes(event.data.checkpointSeq)) {
        prior.push(...event.data.blocks);
        checkpointSeqs.add(event.data.checkpointSeq);
      }
    }
    const rewrite = roughTokens(render(prior)) >= 12000;
    const entries = nodes.flatMap((seq, i) => {
      const message = messages[i];
      if (i < startIndex || !message || checkpointSeqs.has(seq)) return [];
      // The shared Pi prompt only uses these entries to make ID/hint manifest rows.
      return [{ type: 'message', id: id(seq), parentId: null, timestamp: new Date().toISOString(),
        message: { role: 'user', content: textOf(message), timestamp: 0 } }];
    });
    let tokens = 0;
    const choices: { id: string; index: number; tokens: number }[] = [];
    for (let i = nodes.length - 1; i > startIndex; i--) {
      tokens += measurement.nodes[i].tokens;
      if (messages[i] && !checkpointSeqs.has(nodes[i]) && toolPairingBalancedBefore(session, nodes[i]))
        choices.push({ id: id(nodes[i]), index: i, tokens });
    }
    choices.reverse();
    if (!choices.length) throw new Error('Memory has no balanced verbatim tail');
    const target = session.requestHeader()?.config ?? agent.options;
    if (!target.provider || !target.model) throw new Error('Memory needs a routed model');
    let selfAuthored = true;
    for (const event of events) {
      if (event.type === 'request/header' &&
        (event.data.header.config.provider !== target.provider || event.data.header.config.model !== target.model)) selfAuthored = false;
    }
    let generated: any;
    let register = REGISTER;
    for (const introspective of [true, false]) {
      try {
        const assembler = new BlockAssembler();
        const prompt = instruction(prior, entries as any, rewrite, rewrite ? 8000 : 3000, undefined,
          { choices, target: this.config.retainTokens ?? 16000 }, selfAuthored, introspective);
        for await (const chunk of this.ctx.llm.stream({
          provider: target.provider, model: target.model,
          messages: [...messages.filter(m => m !== null), { role: 'user', content: [{ type: 'text', text: prompt }] }],
          tools: session.requestHeader()?.tools, toolHistory: session.toolHistory(),
          maxTokens: this.config.maxTokens, sessionId: session.id, purpose: 'compaction', signal,
        })) assembler.push(chunk);
        if (assembler.finish.kind !== 'stop') throw new Error(
          ('failure' in assembler.finish ? assembler.finish.failure.message : `Memory generation did not finish cleanly: ${assembler.finish.kind}`));
        const rawOutput = assembler.blocks();
        if (rawOutput.some((b: any) => b.type !== 'text' && b.type !== 'reasoning')) throw new Error('Memory returned non-text output');
        generated = { rawOutput, usage: assembler.usage, checkpoint: splitCheckpoint(textOf({ content: rawOutput })) };
        break;
      } catch (error) {
        if (signal?.aborted || !BLOCKED.test(String(error))) throw error;
        if (!introspective) return super.compactRegion(start, end, agent, signal);
        register = `${REGISTER}-fallback-plain`;
      }
    }
    signal?.throwIfAborted();
    if (!isDeepStrictEqual(this.ctx.tokenMeter.measure(session).nodes, measurement.nodes))
      throw new Error('Memory cancelled: conversation changed');
    const chosen = choices.find(c => c.id === generated.checkpoint.tail);
    if (!chosen) throw new Error('Memory chose an invalid tail');
    const covered = nodes.slice(startIndex, chosen.index);
    // Tail references can explain the folded history; coverage still needs original prefix evidence.
    const sources = new Set(entries.map(entry => entry.id));
    for (const block of prior) for (const source of block.sources ?? []) sources.add(source);
    const block = parseBlock(generated.checkpoint.text, sources, prior, rewrite, covered.map(id));
    if (!block.sources?.some(source => covered.some(seq => id(seq) === source)))
      throw new Error('Memory must cite at least one newly folded original entry');
    const blocks = [...(rewrite ? [] : prior), block];
    if (rewrite && roughTokens(render(blocks)) >= 12000) throw new Error('Memory rewrite exceeds budget');
    this.prepared.set(agent, { summary: [{ type: 'text', text: render(blocks) }],
      rawOutput: generated.rawOutput, llmStreamCall: true, usage: generated.usage,
      provider: target.provider, model: target.model, maxTokens: this.config.maxTokens });
    try {
      const result = await super.compactRegion(start, nodes[chosen.index - 1], agent, signal);
      const checkpointSeq = session.surface.nodes[startIndex];
      session.append(RECORD, { version: 1, checkpointSeq, blocks, register, selfAuthored,
        operation: rewrite ? 'rewrite' : 'append', tail: chosen.id }, { ignorable: true });
      return result;
    } finally { this.prepared.delete(agent); }
  }
}
