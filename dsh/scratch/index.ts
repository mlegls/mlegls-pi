import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const name = 'scratch';
export const inject = ['tools'];

export function apply(ctx: Context) {
  // Scratch values belong to the live Session object, not a PTC run or agent turn.
  const sessions = new WeakMap<object, Map<string, JsonValue>>();

  function state(exec: ToolExecution) {
    exec.signal.throwIfAborted();
    const session = exec.agent?.session;
    if (!session) throw new Error('Scratch tools require an agent session');
    let values = sessions.get(session);
    if (!values) sessions.set(session, values = new Map());
    return values;
  }

  ctx.tools.register(defineTool({
    name: 'scratch_get',
    description: 'Get a JSON value by key from this live session’s scratch state. Returns found=false when absent.',
    parameters: { key: { type: 'string', required: true } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          found: { type: 'boolean', required: true },
          value: { type: 'json' },
        },
      },
      render: (_args, result) => [{ type: 'text', text: result.found ? JSON.stringify(result.value) : 'No scratch value for this key.' }],
    },
    async execute({ key }, exec) {
      const values = state(exec);
      if (!values.has(key)) return { found: false };
      return { found: true, value: values.get(key)! };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'scratch_put',
    description: 'Store any JSON value by key in this live session’s scratch state. Values do not survive session reload, process restart, or plugin replacement.',
    parameters: {
      key: { type: 'string', required: true },
      value: { type: 'json', required: true },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, key) => [{ type: 'text', text: `Stored scratch value at ${JSON.stringify(key)}.` }],
    },
    async execute({ key, value }, exec) {
      state(exec).set(key, value);
      return key;
    },
  }));

  ctx.tools.register(defineTool({
    name: 'scratch_delete',
    description: 'Delete a key from this live session’s scratch state. Returns whether it existed.',
    parameters: { key: { type: 'string', required: true } },
    output: {
      schema: { type: 'boolean' },
      render: ({ key }, deleted) => [{ type: 'text', text: deleted ? `Deleted ${JSON.stringify(key)}.` : `No scratch value for ${JSON.stringify(key)}.` }],
    },
    async execute({ key }, exec) {
      return state(exec).delete(key);
    },
  }));

  ctx.tools.register(defineTool({
    name: 'scratch_list',
    description: 'List keys present in this live session’s scratch state, in sorted order.',
    parameters: {},
    output: {
      schema: { type: 'array', items: { type: 'string' } },
      render: (_args, keys) => [{ type: 'text', text: keys.length ? keys.join('\n') : 'No scratch values.' }],
    },
    async execute(_args, exec) {
      return [...state(exec).keys()].sort();
    },
  }));
}
