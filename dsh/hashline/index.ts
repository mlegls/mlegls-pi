import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Ledger } from '../../lib/outline-read/ledger';
import { executeEdits } from '../../lib/outline-read/edit';

export const name = 'hashline';
export const inject = ['tools'];

export function apply(ctx: Context) {
  // PTC cells are stateless; anchors belong to the live agent, not a cell or process.
  const ledgers = new WeakMap<object, Ledger>();
  function state(exec: ToolExecution) {
    if (!exec.agent) throw new Error('Hashline tools require an agent');
    let ledger = ledgers.get(exec.agent);
    if (!ledger) ledgers.set(exec.agent, ledger = new Ledger());
    return { ledger, cwd: exec.agent.session.header.cwd ?? process.cwd() };
  }

  ctx.tools.register(defineTool({
    name: 'read',
    description: 'Read a UTF-8 file as structured anchored lines. Use returned anchors to compute edit hunks. Read again after restarting the agent or reloading this plugin.',
    parameters: {
      path: { type: 'string', required: true },
      offset: { type: 'integer', description: 'One-based first line (default 1).' },
      limit: { type: 'integer', description: 'Maximum lines (default entire file).' },
    },
    output: {
      schema: {
        type: 'array', items: {
          type: 'object', additionalProperties: false,
          properties: {
            n: { type: 'integer', required: true },
            hash: { type: 'string', required: true },
            text: { type: 'string', required: true },
          },
        },
      },
      render: (_args, rows) => [{ type: 'text', text: rows.map(r => `${r.n} ${r.hash}│${r.text}`).join('\n') }],
    },
    async execute(args, exec) {
      const { ledger, cwd } = state(exec);
      const offset = args.offset ?? 1;
      if (offset < 1 || (args.limit !== undefined && args.limit < 1)) throw new Error('offset and limit must be positive');
      const path = resolve(cwd, args.path);
      const raw = await readFile(path, { encoding: 'utf8', signal: exec.signal });
      const lines = raw.split('\n');
      if (lines.length > 1 && raw.endsWith('\n')) lines.pop();
      const snapshot = ledger.sync(path, lines).ledger;
      return snapshot.lines.slice(offset - 1, args.limit === undefined ? undefined : offset - 1 + args.limit)
        .map((r, i) => ({ n: offset + i, hash: r.anchor, text: r.text }));
    },
  }));

  ctx.tools.register(defineTool({
    name: 'edit',
    description: 'Apply hashline hunks computed from read anchors. =abcd replaces one line; =abcd wxyz replaces an inclusive range; -abcd deletes; >abcd inserts after; <abcd inserts before. Header followed by literal new lines; separate hunks with a blank line. Escape header-like body lines with a backslash. Stale anchors are rejected. Earlier files in a multi-file edit are not rolled back on failure.',
    parameters: { edits: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute({ edits }, exec) {
      exec.signal.throwIfAborted();
      const { ledger, cwd } = state(exec);
      const result = await executeEdits({ ledger, persist() {} }, cwd, edits);
      return result.content.map(c => c.text).join('\n');
    },
  }));

  ctx.tools.register(defineTool({
    name: 'write',
    description: 'Create a new UTF-8 file (including parent directories). Never overwrites an existing file; read and edit existing files using anchors.',
    parameters: { path: { type: 'string', required: true }, content: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute({ path, content }, exec) {
      const { cwd } = state(exec);
      const absolute = resolve(cwd, path);
      exec.signal.throwIfAborted();
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, content, { encoding: 'utf8', flag: 'wx', signal: exec.signal });
      return `Created ${absolute}`;
    },
  }));
}
