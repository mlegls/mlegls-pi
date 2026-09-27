import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { defineTool, type ToolExecution } from '@deepseek-ai/dsh-tools';
import { apply as subagentTool, inject as subagentInject } from '@deepseek-ai/dsh-tool-subagent';
import { ReasoningEffortId, ToolCallId } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-agent-preset-registry';
import type {} from '@deepseek-ai/dsh-subagent';
import type {} from '@deepseek-ai/dsh-session-persistence';
import { SessionId } from '@deepseek-ai/dsh-session';
import { parse as parseYaml } from 'yaml';
import { prepare, candidates } from '../../lib/route.ts';
import { mailbox } from '../../lib/board/mailbox.ts';
import { Config as Template, type Config as TemplateConfig } from './template.ts';

export const name = 'dispatch';
export const inject = ['agents', 'agentPresets', 'subagents', 'tools', 'llm', 'sessionProjections', 'sessionPersistence', 'systemPrompt'];
export const Config = z.object({
  presets: z.array(z.string()).required(),
  providerAliases: z.dict(z.string()).default({ deepseek: 'deepseek-official' }),
  policyPath: z.string(),
  maxDepth: z.number().step(1).min(0).default(3),
});
export interface Config { presets: string[]; providerAliases: Record<string, string>; policyPath?: string; maxDepth: number }
const gitExec = promisify(execFile);
const git = async (cwd: string, ...args: string[]) => (await gitExec('git', ['-C', cwd, ...args])).stdout.trim();
interface Workspace { cwd: string; branch: string; repo: string }
interface Launch { template: TemplateConfig; workspace?: Workspace; childId?: string; subscribe: (id: string) => Promise<unknown> }
const launches = new AsyncLocalStorage<Launch>();

export function apply(ctx: Context, config: Config) {
  const policyPath = resolve(config.policyPath ?? fileURLToPath(new URL('../../routing.md', import.meta.url)));
  // The provider only prepares creation data. DSH still owns admission, lineage,
  // persistence, continuation, cancellation and settlement notices.
  for (const preset of config.presets) {
    ctx.subagents.registerProvider({
      name: `dispatch:${preset}`,
      capabilities: { agentOptions: true, depthLimit: true, persona: true, toolFilter: true, outputSchema: false },
      inheritsParentContext: false,
      start: async () => { throw new Error('dispatch requires continuable mode'); },
      async prepareContinuable({ parent, sessionId, signal }) {
        const launch = launches.getStore();
        if (!launch) throw new Error('dispatch provider requires a routed launch');
        signal.throwIfAborted();
        launch.childId = sessionId;
        await launch.subscribe(sessionId);
        if (launch.template.writing) {
          const repo = await git(parent.session.header.cwd || process.cwd(), 'rev-parse', '--show-toplevel');
          const cwd = join(dirname(repo), `${repo.split('/').at(-1)}__worktrees`, `dsh-${sessionId}`);
          const branch = `dsh/${sessionId}`;
          await git(repo, 'worktree', 'add', '-b', branch, cwd, 'HEAD');
          launch.workspace = { cwd, branch, repo };
        }
        return { agentPreset: preset, ...(launch.workspace ? { cwd: launch.workspace.cwd } : {}) };
      },
    });
  }
  const call = async (exec: ToolExecution, name: string, args: unknown) => {
    const result = await ctx.tools.execute({
      name, arguments: args, agent: exec.agent, signal: exec.signal,
      callId: ToolCallId(`${exec.callId}:${randomUUID()}`), rootCallId: exec.rootCallId ?? exec.callId, parent: exec.token,
    });
    if (result.isError) throw new Error(result.content.filter(b => b.type === 'text').map(b => b.text).join('\n'));
    return result.value;
  };
  ctx.tools.register(defineTool({
    name: 'dispatch',
    description: 'Route one self-contained assignment using routing.md and declared presets. Returns a continuable child handle after admission, not its result. Use Promise.all(assignments.map(a => tools.dispatch(a))) for a wave. Results/monitor events arrive on the child board topic and settlement arrives by notice; send_message continues it. Writing presets receive a retained Git worktree. Capacity rejects rather than queues.',
    parameters: {
      prompt: { type: 'string', required: true },
      assignee: { type: 'string', description: 'Tracker assignment, default agent. A pinned stance/model is binding.' },
      stance: { type: 'string', description: 'Optional recorded routing stance.' },
      usage: { type: 'json', description: 'Optional provider routing-ceiling fractions; unknown is not zero.' },
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent;
      if (!parent) throw new Error('dispatch requires an agent');
      const templates = await Promise.all(config.presets.map(async preset => {
        const resolved = await ctx.agentPresets.resolve(preset);
        if (resolved.broken) throw new Error(`${preset}: ${resolved.broken}`);
        const rows = parseYaml((await ctx.agentPresets.readDocument(preset)).content);
        const row = rows.find((row: { id?: string }) => row.id === 'dispatch-template');
        if (!row) throw new Error(`${preset} requires a dispatch-template row`);
        return { preset, template: Template(row.config) };
      }));
      const preferences = Object.fromEntries(templates.map(({ template: t }) => [t.stance, { model: t.model, effort: t.effort }]));
      if (Object.keys(preferences).length !== templates.length) throw new Error('dispatch presets must have distinct stances');
      const providers = new Set(ctx.llm.listProviders().map(p => p.id));
      const catalog = readFileSync(policyPath, 'utf8').split('## Active catalog')[1];
      if (!catalog) throw new Error('routing policy lacks Active catalog');
      const unavailableProviders = Object.fromEntries(candidates(catalog).map(c => c.model.split('/')[0])
        .filter(p => !providers.has(config.providerAliases[p] ?? p)).map(p => [p, 'No DSH adapter registered']));
      const route = await prepare(args.prompt, {
        policyPath, assignee: args.assignee ?? 'agent', stance: args.stance,
        allowedStances: templates.map(t => t.template.stance), preferences,
        unavailableProviders, usage: args.usage as Record<string, number | null> | undefined,
      });
      exec.signal.throwIfAborted();
      const { preset, template } = templates.find(t => t.template.stance === route.stance)!;
      const [provider, model] = route.model.split('/');
      const toolName = `dispatch_launch_${randomUUID().replaceAll('-', '')}`;
      const launch: Launch = { template, subscribe: id => call(exec, 'board_subscribe', { topic: mailbox(id), tags: 'turn-end | crashed | exited', wake: true }) };
      const fiber = parent.ctx.plugin({ inject: subagentInject, apply(scope: Context) {
        subagentTool(scope, {
          provider: `dispatch:${preset}`, toolName, backgroundMode: 'continuable', maxDepth: config.maxDepth,
          agentOptions: { provider: config.providerAliases[provider] ?? provider, model, reasoningEffort: ReasoningEffortId(route.effort) },
        });
      } });
      try {
        await fiber.await();
        const started = await launches.run(launch, () => call(exec, toolName, {
          description: `${route.stance} assignment`, prompt: args.prompt,
          run_in_background: true,
        })) as { kind: string; subagentId: string };
        const topic = mailbox(started.subagentId);
        return { kind: 'continuable', subagentId: started.subagentId, topic, preset,
          stance: route.stance, model: route.model, effort: route.effort,
          cwd: launch.workspace?.cwd ?? parent.session.header.cwd ?? process.cwd(),
          ...(launch.workspace ? { branch: launch.workspace.branch } : {}) };
      } catch (error) {
        // Never remove a published child's checkout (including an already settled
        // durable child). Failed preparation alone can be rolled back safely.
        if (launch.workspace && launch.childId && !await ctx.sessionPersistence.stat(SessionId(launch.childId))) {
          await git(launch.workspace.repo, 'worktree', 'remove', launch.workspace.cwd);
          await git(launch.workspace.repo, 'branch', '-D', launch.workspace.branch);
        }
        throw error;
      } finally {
        await fiber.dispose();
      }
    },
  }));
}
