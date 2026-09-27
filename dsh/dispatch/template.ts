import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-system-prompt';
import type {} from '@deepseek-ai/dsh-tools';
import { scopeOf, scopeChainOf } from '@deepseek-ai/dsh-scope';
import type {} from '@deepseek-ai/dsh-agent';

/** A preset's routing defaults and scoped capability/prompt policy. */
export const Config = z.object({
  stance: z.string().required(),
  model: z.string().required(),
  effort: z.string().required(),
  writing: z.boolean().default(true),
  prompt: z.string().required(),
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()),
});
export interface Config { stance: string; model: string; effort: string; writing: boolean; prompt: string; skills: string[]; tools?: string[] }
export const name = 'dispatch-template';
export const inject = ['tools', 'systemPrompt'];
export function apply(ctx: Context, config: Config) {
  if (!config.writing && !config.tools?.length) throw new Error('read-only dispatch templates require a tool allowlist');
  // Presets activate before all host tools necessarily exist. Restrict only in
  // the publication window, once the selected child's full tool set is present.
  if (config.tools) ctx.on('agent/created', ({ agent }) => {
    if (scopeChainOf(scopeOf(agent.ctx)).includes(scopeOf(ctx)!)) agent.ctx.tools.restrict({ allow: config.tools });
    return undefined;
  });
  ctx.systemPrompt.section({
    name: 'dispatch:template', order: 50,
    text: config.prompt + (config.skills.length ? `\nLoad these skills before working: ${config.skills.join(', ')}.` : ''),
  });
}
