// Opt-in Web-host probe. Never loaded by the normal dispatch overlay.
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { scopeOf } from '@deepseek-ai/dsh-scope';
export const inject = ['agents', 'agentPresets', 'tools'];
export function apply(ctx) {
  const log = (event, data) => appendFileSync(join(process.env.DSH_HOME, 'dispatch-probe.jsonl'), JSON.stringify({ time: new Date().toISOString(), event, ...data }) + '\n');
  let parent;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  ctx.on('agent/status', ({ agent, status }) => log('status', { id: agent.id, status }));
  ctx.on('agent/inbox/inserted', ({ agent, message }) => log('inbox', { id: agent.id, source: message.source, content: message.content }));
  ctx.on('agent/error', ({ agent, error }) => log('error', { id: agent.id, error: String(error) }));
  ctx.on('agent/pre-step', async ({ agent, messages }, next) => {
    log('tools', { id: agent.id, scoped: ctx.tools.schemas(scopeOf(agent.ctx)).map(t => t.name), global: ctx.tools.schemas().map(t => t.name) });
    if (parent && agent.session.header.parentSession === parent.id) {
      await gate;
      if (JSON.stringify(messages).includes('DSH_CRASH_PROBE')) throw new Error('DSH_CRASH_PROBE: deliberate child pre-step failure');
    }
    return next();
  });
  async function run() {
    const owned = await ctx.agents.create({
      sessionId: SessionId(randomUUID()), meta: { cwd: process.cwd(), agentPreset: 'hashline' },
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'low' },
      setup: async scope => { await ctx.agentPresets.mount(scope, 'hashline'); },
    });
    parent = owned.agent;
    log('parent', { id: parent.id, cwd: parent.session.header.cwd });
    parent.followup(createUserMessage({ content: [{ type: 'text', text: 'Reply READY now. Later, when child board or settlement notices arrive, read exactly their mail topics with board_read and report their results. Do not dispatch children yourself.' }], source: { kind: 'user' } }));
    await parent.whenIdle();
    const result = await ctx.tools.execute({
      name: 'run_code', agent: parent, signal: new AbortController().signal, callId: ToolCallId(randomUUID()),
      arguments: { description: 'Launch three gated preset children', code: `console.log(await Promise.all([
        { assignee: 'agent:research', prompt: 'Use tools.read to read package.json, then reply DSH_IDLE_WAKE_RESULT and its package name. Do not modify anything.' },
        { assignee: 'agent:research', prompt: 'DSH_CRASH_PROBE: this assignment deliberately fails before its model request.' },
        { assignee: 'agent:fill, model:deepseek/deepseek-flash:low', prompt: 'No-edit worktree smoke check. Use tools.shell({command:"pwd; git rev-parse HEAD"}) and return its output. Do not use Node APIs, modify files, commit, or send_message. Return a final answer.' }
      ].map(a => tools.dispatch(a))));` },
    });
    log('handles', { idle: parent.status === 'idle', result });
    release();
  }
  const timer = setTimeout(() => { void run().catch(error => { log('driver-error', { error: String(error) }); release(); }); }, 1000);
  ctx.effect(() => () => clearTimeout(timer));
}
