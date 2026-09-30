/** Replay of docs/attachments/reconcile/index.md checks 1–4 and the copy-owned acceptance path of check 5. */
import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attach, load, mark, move, orphans } from './outliner.ts';

const base = mkdtempSync(join(tmpdir(), 'outliner-reconcile-'));
const vault = join(base, 'vault');
const canonical = join(base, 'canonical', 'fixture');
const checkout = join(base, 'checkout', 'fixture');
const note = join(vault, 'directing multi-agent work.md');
const link = (slug: string) => `[[projects/fixture/issues/${slug}]]`;
const original = `## plans
- clean up [[fixture]] → ${link('cleanup')}
- make routing scripts → ${link('dispatch')} #routing
- unify workflow control → ${link('reconcile')}

## fleeting
- research pareto frontier #research

## efforts

# Other work
- not an outliner bullet
`;
for (const directory of [canonical, checkout]) {
  mkdirSync(join(directory, 'docs/issues/archive'), { recursive: true });
  const put = (slug: string, text: string, archive = false) =>
    writeFileSync(join(directory, 'docs/issues', archive ? 'archive' : '', slug + '.md'), `---\n${text}\n---\n`);
  put('cleanup', 'stage: goal\nassignee: human');
  put('dispatch', 'stage: done', true);
  put('reconcile', directory === checkout ? 'stage: done' : 'stage: spec');
  put('home-ui', 'stage: goal');
}
mkdirSync(join(vault, 'projects'), { recursive: true });
symlinkSync(join(checkout, 'docs'), join(vault, 'projects/fixture'));
writeFileSync(note, original);
process.env.TRACKER_VAULT = vault;
afterAll(() => { rmSync(base, { recursive: true, force: true }); });

test('drive checks 1–2: explicit checkout classifies the note and reports live unlinked issues', () => {
  const other = load(note, canonical);
  const result = load(note, checkout);
  expect(other.directory).toBe(canonical);
  expect(other.sections.plans[2].issue?.issue?.stage).toBe('spec');
  expect(result.directory).toBe(checkout);
  expect(result.sections.plans.map(b => b.text.split('\n')[0])).toEqual(original.split('\n').slice(1, 4));
  expect(result.sections.fleeting).toHaveLength(1);
  expect(result.sections.efforts).toHaveLength(0);
  expect(result.bullets).toHaveLength(4); // # Other work ends the outliner.
  expect(result.sections.plans[0].issue?.issue?.stage).toBe('goal');
  expect(result.sections.plans[1].issue?.issue?.archived).toBe(true);
  expect(result.sections.plans[1].tags).toEqual(['routing']);
  expect(result.sections.plans[2].issue?.issue?.stage).toBe('done');
  expect(result.sections.fleeting[0].issue).toBeUndefined();
  expect(orphans(result).map(i => i.slug)).toEqual(['home-ui']);
});

test('drive checks 3 and 5: accepted move and completion change exactly the displayed bullets', () => {
  writeFileSync(note, original);
  const before = load(note, checkout);
  expect(readFileSync(note, 'utf8')).toBe(original); // proposal without acceptance
  move(before.sections.plans[0], { to: 'efforts', issue: 'cleanup' });
  const moved = load(note, checkout);
  expect(moved.sections.plans).toHaveLength(2);
  expect(moved.sections.efforts.map(b => b.text)).toEqual([before.sections.plans[0].text]);
  mark(moved.sections.plans[0], 'done');
  const accepted = readFileSync(note, 'utf8');
  expect(load(note, checkout).sections.plans[0].done).toBe(true);
  expect(accepted).toContain(`- make routing scripts → ${link('dispatch')} #done #routing`);
  expect(accepted).toContain('- research pareto frontier #research');
  expect(accepted).toContain('# Other work\n- not an outliner bullet');
});

test('drive checks 4–5: intervening edit anywhere in the proposed note refuses acceptance', () => {
  writeFileSync(note, original);
  const proposal = load(note, checkout).sections.plans[1];
  const changed = original.replace('research pareto frontier', 'research pareto frontiers');
  writeFileSync(note, changed);
  expect(() => mark(proposal, 'done')).toThrow('Outliner note changed; reload and propose the diff again.');
  expect(readFileSync(note, 'utf8')).toBe(changed);
});

test('unresolved research intent is not auto-introduced; an agreed draft becomes a linked tracker issue', () => {
  writeFileSync(note, original);
  const bullet = load(note, checkout).sections.fleeting[0];
  expect(() => attach(bullet)).toThrow('Introduce the intent and supply an agreed issue draft');
  expect(readFileSync(note, 'utf8')).toBe(original);
  const session = process.env.PI_SESSION_ID;
  process.env.PI_SESSION_ID = 'outliner-reconcile-test';
  try {
    const result = attach(bullet, { title: 'Pareto frontier routing research', slug: 'pareto-routing', stage: 'idea', body: 'Decide whether routing research is still wanted.' });
    expect(result.slug).toBe('pareto-routing');
    expect(load(note, checkout).sections.fleeting[0].issue?.issue?.stage).toBe('idea');
    expect(readFileSync(note, 'utf8')).toContain(`${link('pareto-routing')} #research`);
  } finally {
    if (session === undefined) delete process.env.PI_SESSION_ID;
    else process.env.PI_SESSION_ID = session;
  }
});
