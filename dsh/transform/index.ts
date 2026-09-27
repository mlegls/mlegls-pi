import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import '@deepseek-ai/dsh-shell';
import '@deepseek-ai/dsh-shell-env';
import '@deepseek-ai/dsh-sandbox-policy';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeHunks, type Hunk } from '../../lib/outline-read/edit';
import { state } from '../hashline/state';

export const name = 'transform';
export const inject = ['tools', 'shell', 'shellEnv'];
const binary = resolve(dirname(fileURLToPath(import.meta.url)), '../node_modules/.bin/ast-grep');
const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;
const linesOf = (s: string) => s.endsWith('\n') ? s.split('\n').slice(0, -1) : s.split('\n');

export function apply(ctx: Context) {
  // Resolve the same per-session sandbox policy as tool-bash; no escalation surface.
  const policy = ctx.shell.sandboxMode === undefined ? undefined : ctx.get('sandboxPolicy');
  if (ctx.shell.sandboxMode !== undefined && !policy) throw new Error('transform: sandboxing executor requires sandboxPolicy');
  // The shell is a JSON tool binding. A program can wrap it in a local $ template,
  // with interpolations shell-quoted by the program (see README).
  ctx.tools.register(defineTool({
    name: 'shell',
    description: 'Run a foreground bash command (pipes and one-liners) through the configured dsh shell executor and standing sandbox policy. No escalation or background jobs. Returns captured stdout, stderr, exit code; truncation is reported, never silently discarded.',
    parameters: { command: { type: 'string', required: true }, timeoutMs: { type: 'integer' } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        stdout: { type: 'string', required: true }, stderr: { type: 'string', required: true },
        code: { type: 'json', required: true }, truncated: { type: 'boolean', required: true },
        timedOut: { type: 'boolean', required: true },
      } },
      render: (_args, r) => [{ type: 'text', text: `${r.stdout}${r.stderr ? `\n[stderr]\n${r.stderr}` : ''}\n[exit code: ${r.code}]${r.truncated ? ' [output truncated]' : ''}${r.timedOut ? ' [timed out]' : ''}` }],
    },
    async execute(args, exec) {
      if (!args.command.trim()) throw new Error('command is empty');
      if (args.timeoutMs !== undefined && args.timeoutMs <= 0) throw new Error('timeoutMs must be positive');
      const { cwd } = state(exec);
      const result = await (await ctx.shell.execute(ctx.shell.resolve({
        command: args.command, workdir: cwd, timeoutMs: args.timeoutMs, signal: exec.signal,
        dshEnv: ctx.shellEnv.collect(exec),
        sandboxPolicy: policy?.resolve({ session: exec.agent!.session }),
      }))).result();
      if (result.aborted) throw new Error('shell aborted');
      return { stdout: result.stdout.text, stderr: result.stderr.text, code: result.exitCode,
        truncated: result.stdout.truncated || result.stderr.truncated, timedOut: result.timedOut };
    },
  }));

  ctx.tools.register(defineTool({
    name: 'transform',
    description: 'Run ast-grep pattern/rewrite against listed files and apply all matches as one anchored edit batch. Uses the session ledger; reread after restarting. Files already on disk only; earlier files are not rolled back on failure. No arbitrary source functions cross the JSON binding: compute line replacements in run_code and submit them to edit.',
    parameters: {
      files: { type: 'array', items: { type: 'string' }, required: true },
      pattern: { type: 'string', required: true }, rewrite: { type: 'string', required: true },
      language: { type: 'string', required: true },
    },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute(args, exec) {
      const { cwd, ledger } = state(exec);
      if (!args.files.length || args.files.length > 100 || new Set(args.files.map(p => resolve(cwd, p))).size !== args.files.length) throw new Error('Provide 1–100 distinct files');
      const hunks: Hunk[] = [];
      let matches = 0;
      const originals = new Map<string, string>();
      for (const path of args.files) {
        exec.signal.throwIfAborted();
        const absolute = resolve(cwd, path);
        const raw = await readFile(absolute, { encoding: 'utf8', signal: exec.signal });
        originals.set(absolute, raw);
        const old = linesOf(raw);
        const snapshot = ledger.sync(absolute, old).ledger;
        const result = await (await ctx.shell.execute(ctx.shell.resolve({
          command: `${quote(binary)} run --stdin --json=compact --lang ${quote(args.language)} --pattern ${quote(args.pattern)} --rewrite ${quote(args.rewrite)}`,
          workdir: cwd, stdin: raw, signal: exec.signal, dshEnv: ctx.shellEnv.collect(exec),
          sandboxPolicy: policy?.resolve({ session: exec.agent!.session }),
        }))).result();
        if (result.aborted) throw new Error('ast-grep aborted');
        if (result.exitCode !== 0 || result.timedOut || result.stdout.truncated || result.stderr.truncated) throw new Error(`ast-grep failed for ${path}: ${result.stderr.text || `exit ${result.exitCode}, timeout/truncated output`}`);
        const found = JSON.parse(result.stdout.text) as Array<{ replacement: string; replacementOffsets: { start: number; end: number } }>;
        if (!found.length) continue;
        matches += found.length;
        const bytes = Buffer.from(raw);
        let cursor = 0;
        const parts: Buffer[] = [];
        for (const match of found.sort((a, b) => a.replacementOffsets.start - b.replacementOffsets.start)) {
          const { start, end } = match.replacementOffsets;
          if (start < cursor || end < start || end > bytes.length) throw new Error(`Overlapping/invalid ast-grep matches in ${path}; nothing applied`);
          parts.push(bytes.subarray(cursor, start), Buffer.from(match.replacement));
          cursor = end;
        }
        parts.push(bytes.subarray(cursor));
        const next = Buffer.concat(parts).toString('utf8');
        // executeHunks preserves unchanged anchors; compare complete input before applying
        // because a whole-file replacement must not overwrite a concurrent interior change.
        // It retains the file's original trailing newline, so reject rewrites which change it.
        if (next.endsWith('\n') !== raw.endsWith('\n')) throw new Error(`Trailing newline changed in ${path}; nothing applied`);
        if (next === raw) continue;
        hunks.push({ mode: 'replace', from: snapshot.lines[0]!.anchor, to: snapshot.lines.at(-1)!.anchor,
          header: `ast-grep @${relative(cwd, absolute)}`, path, lines: linesOf(next), literal: true });
      }
      if (!hunks.length) return `${matches} matches; no changes.`;
      for (const [absolute, original] of originals) {
        if (await readFile(absolute, { encoding: 'utf8', signal: exec.signal }) !== original)
          throw new Error(`${relative(cwd, absolute)} changed during transform; nothing applied`);
      }
      const result = await executeHunks({ ledger, persist() {} }, cwd, hunks);
      return `${matches} matches in ${hunks.length} files.\n${result.content.map(c => c.text).join('\n')}`;
    },
  }));
}
