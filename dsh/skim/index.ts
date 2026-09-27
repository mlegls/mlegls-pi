import type { Context } from '@deepseek-ai/cordis';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { create as createIngress } from '../../lib/ingress.ts';
import type { SpillRef } from '@deepseek-ai/dsh-spill';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';

export const name = 'skim';
export const inject = ['tools', 'spillStore'];

const runCodeBudget = 4096;
type State = { refs: Map<string, SpillRef> };

export function apply(ctx: Context) {
  const states = new WeakMap<object, State>();

  function state(exec: ToolExecution) {
    if (!exec.agent) throw new Error('Skim tools require an agent');
    let value = states.get(exec.agent);
    if (!value) states.set(exec.agent, value = { refs: new Map() });
    return value;
  }

  function ingress(exec: ToolExecution, owner: State) {
    return createIngress({
      async retain(id, text) {
        const ref = await ctx.spillStore.saveText({
          owner: { sessionId: exec.agent!.session.header.id },
          source: { kind: 'tool', toolName: exec.name, callId: exec.callId, label: id },
          suggestedName: `${id}.txt`,
          content: text,
        });
        owner.refs.set(id, ref);
      },
      async retrieve(id) {
        const ref = owner.refs.get(id);
        return ref ? readFile(ref.locator, 'utf8') : undefined;
      },
    });
  }

  async function skim(exec: ToolExecution, text: string, query: string, focus: string, budget?: number) {
    const kernel = ingress(exec, state(exec));
    try {
      return await kernel.filter(text, query, budget, focus);
    } finally {
      kernel.dispose();
    }
  }

  ctx.tools.register(defineTool({
    name: 'skim',
    description: 'Skim text for the supplied focus. Incomplete pages carry ing-… ids; use pull({ id }) to recover them verbatim.',
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
      const kernel = ingress(exec, state(exec));
      try {
        return await kernel.recall(id);
      } finally {
        kernel.dispose();
      }
    },
  }));

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next();
    if (exec.name !== 'run_code' || result.isError || decision.kind !== 'accept') return decision;
    if ('value' in decision) return decision;
    const content = decision.content ?? result.content;
    if (content.some(block => block.type !== 'text')) return decision;
    const original = content.map(block => block.type === 'text' ? block.text : '').join('');
    if (Buffer.byteLength(original, 'utf8') <= runCodeBudget) return decision;

    const args = exec.arguments as { code?: unknown; description?: unknown };
    const description = typeof args.description === 'string' ? args.description : 'run_code result';
    const focus = typeof args.code === 'string' ? args.code : description;
    let filtered: string;
    try {
      filtered = await skim(exec, original, description, focus, runCodeBudget);
    } catch (error) {
      ctx.logger.warn(`run_code skim unavailable; keeping the full result: ${String(error)}`);
      return decision;
    }
    if (filtered !== original && Buffer.byteLength(filtered, 'utf8') <= runCodeBudget) {
      return { ...decision, content: [{ type: 'text', text: filtered }] };
    }

    const owner = state(exec);
    const id = `ing-${createHash(original).update(focus).digest('hex').slice(0, 16)}`;
    if (!owner.refs.has(id)) {
      try {
        const ref = await ctx.spillStore.saveText({
          owner: { sessionId: exec.agent!.session.header.id },
          source: { kind: 'tool', toolName: exec.name, callId: exec.callId, label: 'result' },
          suggestedName: 'run_code.txt',
          content: original,
        });
        owner.refs.set(id, ref);
      } catch (error) {
        ctx.logger.warn(`run_code result spill unavailable; keeping the full result: ${String(error)}`);
        return decision;
      }
    }
    return {
      ...decision,
      content: [{ type: 'text', text: `[run_code result exceeded ${runCodeBudget} bytes; full result retained as ${id}. Use tools.pull({ id: "${id}" }) to recover it verbatim.]` }],
    };
  }, { prepend: true });
}
