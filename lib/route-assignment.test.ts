import { test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agent } from './agents.ts';
import { candidates, prepare, route, assigned } from './route.ts';
import { dispatch } from './dispatch.ts';

test('a fill assignment can use its default or an independently pinned model', async () => {
  const standard = await prepare('A supplied bounded edit', { assignee: 'agent:fill' });
  if (standard.kind !== "ready") throw new Error("Expected ready assignment");
  expect([standard.agent, standard.model, standard.effort]).toEqual(['fill', 'openai-codex/gpt-6-luna', 'high']);
  const override = await prepare('The same bounded edit', { assignee: 'agent:fill, model:zai/glm-5.3-flash:high' });
  if (override.kind !== "ready") throw new Error("Expected ready assignment");
  expect([override.agent, override.model, override.effort]).toEqual(['fill', 'zai/glm-5.3-flash', 'high']);
  expect(override.assignee).toBe('agent:fill, model:zai/glm-5.3-flash:high');
  expect((await route('research', 'Evidence only', { assignee: 'model:zai/glm-5.3-flash:high' })).model).toBe('zai/glm-5.3-flash');
});

test('explicit agent assignments read model and effort from agent files', () => {
  for (const stance of ['compile', 'technical', 'research', 'verify']) {
    const preference = agent(stance);
    if (!preference?.model || !preference.effort) throw new Error(`Incomplete preference: ${stance}`);
    expect(assigned({ assignee: `agent:${stance}` }).execution).toEqual({ model: preference.model, effort: preference.effort });
  }
});

test('agent preferences are eligible catalog pairs', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const policy = readFileSync(join(root, 'routing.md'), 'utf8');
  const catalog = policy.split('## catalog ')[1];
  const available = candidates(catalog);
  for (const file of readdirSync(join(root, 'agents')).filter(f => !f.startsWith('_'))) {
    const preference = agent(file.replace(/\.md$/, ''));
    if (!preference?.model || !preference.effort) throw new Error(`Incomplete preference: ${file}`);
    expect(available).toContainEqual({ model: preference.model, effort: preference.effort });
  }
});

test('unavailable assignments do not fall back and shorthand is not guessed', () => {
  expect(() => assigned({ assignee: 'agent:fill', unavailableProviders: { 'openai-codex': 'unavailable' } })).toThrow('unavailable');
  expect(() => assigned({ assignee: 'model:zai/glm-5.3-flash:high', usage: { zai: 1 } })).toThrow('ceiling');
  for (const assignee of ['fill', 'glm-5.3-flash:high', 'agent:fill, agent:auto', 'model:zai/glm-5.3-flash:high, model:zai/glm-5.3-flash:high'])
    expect(() => assigned({ assignee })).toThrow('selector');
  expect(() => assigned({ assignee: 'model:zai/missing:high' })).toThrow('Unknown');
});

test('tracker launches require eligibility and preserve the selected stance/model', async () => {
  const task = { handle: 'probe', issue: 'example', prompt: 'Must not launch', agent: 'fill', model: 'zai/glm-5.3-flash', effort: 'high' };
  const options = { run: 'run_test', maxConcurrent: 1, active: [] };
  await expect(dispatch([task], options)).rejects.toThrow('Unassigned');
  for (const assignee of ['human', 'user:mlegls', 'session:original'])
    await expect(dispatch([{ ...task, assignee }], options)).rejects.toThrow('human or exact existing session');
  await expect(dispatch([{ ...task, assignee: 'agent:fill' }], options)).rejects.toThrow('conflicts');
  await expect(prepare('An edit', { assignee: 'agent:fill', stance: 'auto' })).rejects.toThrow('conflicts');
});
