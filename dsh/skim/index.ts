import type { Context } from '@deepseek-ai/cordis';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { SpillRef } from '@deepseek-ai/dsh-spill';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'skim/retained': { id: string; ref: SpillRef };
  }
}
export const name = 'skim';
export const inject = ['tools', 'spillStore', 'sessions'];

const runCodeBudget = 4096;
const RETAINED = 'skim/retained';
type State = { refs: Map<string, SpillRef>; recalled: Set<string> };

export function apply(ctx: Context) {
  const states = new WeakMap<object, State>();

  async function retain(exec: ToolExecution, owner: State, id: string, text: string) {
    if (owner.refs.has(id)) return;
    const ref = await ctx.spillStore.saveText({
      owner: { sessionId: exec.agent!.session.header.id },
      source: { kind: 'tool', toolName: exec.name, callId: exec.callId, label: id },
      suggestedName: `${id}.txt`, content: text,
    });
    exec.agent!.session.append(RETAINED, { id, ref }, { ignorable: true });
    if (!await ctx.sessions.flush(exec.agent!.session)) throw new Error('Skim retention requires session persistence');
    owner.refs.set(id, ref);
  }
  function state(exec: ToolExecution) {
    if (!exec.agent) throw new Error('Skim tools require an agent');
    let value = states.get(exec.agent);
    if (!value) {
      const refs = new Map<string, SpillRef>();
      for (const event of exec.agent.session.snapshotEvents()) {
        if (event.type === RETAINED) refs.set(event.data.id, event.data.ref);
      }
      states.set(exec.agent, value = { refs, recalled: new Set() });
    }
    return value;
  }

  async function skim(exec: ToolExecution, text: string, _query: string, _focus: string, budget = runCodeBudget) {
    const bytes = Buffer.from(text);
    if (bytes.length <= budget) return text;
    const owner = state(exec);
    const id = `ing-${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
    await retain(exec, owner, id, text);
    const notice = `\n[output truncated; ${id}; full output: ${owner.refs.get(id)!.locator}. Grep this file for what you need rather than reading it whole.]`;
    let end = Math.max(0, budget - Buffer.byteLength(notice));
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
    return bytes.subarray(0, end).toString() + notice;
  }

  ctx.tools.register(defineTool({
    name: 'skim',
    description: 'Display text with a size cap and a searchable saved original. Legacy name; no semantic skimming. Use jg for repository discovery.',
    parameters: {
      text: { type: 'string', required: true },
      focus: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute({ text, focus }, exec) {
      return skim(exec, text, focus, focus);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'pull',
    description: 'Recover one ing-… page returned by skim, verbatim.',
    parameters: { id: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute({ id }, exec) {
      const ref = state(exec).refs.get(id);
      if (!ref) throw new Error('Unknown ingress page ' + id);
      if (exec.rootCallId) state(exec).recalled.add(exec.rootCallId);
      return readFile(ref.locator, 'utf8');
    },
  }));

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next();
    // An explicit pull is a request for exact output, not another attention pass.
    if (exec.name === 'run_code' && exec.agent && state(exec).recalled.delete(exec.callId)) return decision;
    if (exec.name !== 'run_code' || result.isError || decision.kind !== 'accept') return decision;
    if ('value' in decision) return decision;
    const content = decision.content ?? result.content;
    if (content.some(block => block.type !== 'text')) return decision;
    const original = content.map(block => block.type === 'text' ? block.text : '').join('');
    if (Buffer.byteLength(original, 'utf8') <= runCodeBudget) return decision;

    try {
      const text = await skim(exec, original, '', '', runCodeBudget);
      return { ...decision, content: [{ type: 'text', text }] };
    } catch (error) {
      ctx.logger.warn(`run_code result spill unavailable; keeping the full result: ${String(error)}`);
      return decision;
    }
  }, { prepend: true });
}
