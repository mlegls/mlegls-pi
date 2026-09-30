import { test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agent, executions } from './agents.ts';
import { candidates, prepare, route, assigned } from './route.ts';
import { dispatch } from './dispatch.ts';

const onlyOai = { unavailableProviders: { zai: 'test', deepseek: 'test', anthropic: 'test' } };

test('a fill assignment can use its model line or an independently pinned model', async () => {
  const standard = await prepare('A supplied bounded edit', { assignee: 'agent:fill', ...onlyOai });
  if (standard.kind !== "ready") throw new Error("Expected ready assignment");
  expect([standard.agent, standard.model, standard.effort]).toEqual(['fill', 'openai-codex/gpt-6-luna', 'high']);
  const override = await prepare('The same bounded edit', { assignee: 'agent:fill, model:zai/glm-5.3-flash:high' });
  if (override.kind !== "ready") throw new Error("Expected ready assignment");
  expect([override.agent, override.model, override.effort]).toEqual(['fill', 'zai/glm-5.3-flash', 'high']);
  expect(override.assignee).toBe('agent:fill, model:zai/glm-5.3-flash:high');
  expect((await route('research', 'Evidence only', { assignee: 'model:zai/glm-5.3-flash:high' })).model).toBe('zai/glm-5.3-flash');
});

test('an agent pin keeps its model line, fallbacks included', async () => {
  expect(assigned({ assignee: 'agent:fill' })).toEqual({ stance: 'fill', execution: undefined });
  const fallback = await prepare('A bounded edit', { assignee: 'agent:fill', unavailableProviders: { 'openai-codex': 'test', deepseek: 'test' } });
  expect([fallback.model, fallback.effort]).toEqual(['zai/glm-5.3-flash', 'high']);
  await expect(prepare('A bounded edit', { assignee: 'agent:fill', usage: { 'openai-codex': 1, zai: 1, deepseek: 1 } })).rejects.toThrow('ceiling');
});

test('every agent has a model line of catalogued candidates', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const policy = readFileSync(join(root, 'routing.md'), 'utf8');
  const available = candidates(policy.split('## Active catalog ')[1]);
  for (const file of readdirSync(join(root, 'agents')).filter(f => f.endsWith('.md') && !f.startsWith('_'))) {
    const line = agent(file.replace(/\.md$/, ''))?.routing;
    if (!line) throw new Error(`No model line: ${file}`);
    for (const execution of executions(line)) expect(available).toContainEqual(execution);
  }
});

test('unavailable model pins do not fall back and shorthand is not guessed', () => {
  expect(() => assigned({ assignee: 'model:openai-codex/gpt-6-luna:high', unavailableProviders: { 'openai-codex': 'unavailable' } })).toThrow('unavailable');
  expect(() => assigned({ assignee: 'model:zai/glm-5.3-flash:high', usage: { zai: 1 } })).toThrow('ceiling');
  for (const assignee of ['fill', 'glm-5.3-flash:high', 'agent:fill, agent:auto', 'model:zai/glm-5.3-flash:high, model:zai/glm-5.3-flash:high'])
    expect(() => assigned({ assignee })).toThrow('selector');
  expect(() => assigned({ assignee: 'model:zai/missing:high' })).toThrow('Unknown');
});

test('tracker launches require eligibility and preserve the selected stance/model', async () => {
  const task = { handle: 'probe', issue: 'example', prompt: 'Must not launch', agent: 'fill', model: 'openai-codex/gpt-6.1-sol', effort: 'high' };
  const options = { run: 'run_test', maxConcurrent: 1, active: [] };
  await expect(dispatch([task], options)).rejects.toThrow('Unassigned');
  for (const assignee of ['human', 'user:mlegls', 'session:original'])
    await expect(dispatch([{ ...task, assignee }], options)).rejects.toThrow('human or exact existing session');
  await expect(dispatch([{ ...task, assignee: 'agent:fill' }], options)).rejects.toThrow('conflicts');
  await expect(prepare('An edit', { assignee: 'agent:fill', stance: 'auto' })).rejects.toThrow('conflicts');
});

test('host model lines override the roster without overriding explicit pins', async () => {
  const preferences = { fill: 'prefer deepseek/deepseek-flash:low' };
  const options = { preferences, allowedStances: ['fill'], assignee: 'agent:fill' };
  const selected = await prepare('A bounded edit', options);
  expect([selected.stance, selected.model, selected.effort]).toEqual(['fill', 'deepseek/deepseek-flash', 'low']);
  const pinned = await prepare('A bounded edit', { ...options, assignee: 'agent:fill, model:zai/glm-5.3-flash:high' });
  expect([pinned.model, pinned.effort]).toEqual(['zai/glm-5.3-flash', 'high']);
  await expect(prepare('A bounded edit', { ...options, unavailableProviders: { deepseek: 'offline' } })).rejects.toThrow('ceiling');
});
