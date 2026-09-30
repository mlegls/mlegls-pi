// bun live-setup.ts prepare [source checkout] | rollback /absolute/backup-directory
// The installed plugin directory remains the canonical checkout's dist symlink.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

const vault = join(homedir(), 'obsidian');
const canonical = join(homedir(), 'dev/mlegls-pi');
const base = join(vault, 'projects/Tracker.base');
const plugins = join(vault, '.obsidian/community-plugins.json');
const dist = join(canonical, 'extensions/obsidian-tracker/dist');
const assets = ['main.js', 'manifest.json', 'styles.css'].map(f => join(dist, f));
const managed = [base, plugins, ...assets];
const bytes = (p: string) => readFileSync(p);
const hash = (p: string) => createHash('sha256').update(bytes(p)).digest('hex');
const insist = (ok: unknown, why: string): asserts ok => { if (!ok) throw Error(why); };
const route = join(vault, '.obsidian/plugins/tracker');
insist(realpathSync(route) === realpathSync(dist), `Refusing unexpected plugin target: ${route}`);
const [action, argument] = process.argv.slice(2);
if (action === 'rollback') {
  insist(argument && resolve(argument).startsWith(join(vault, '.obsidian/tracker-rollout-')), 'Provide this vault\'s rollout backup path');
  const meta = JSON.parse(readFileSync(join(argument, 'manifest.json'), 'utf8')) as { paths: string[]; after: Record<string,string> };
  insist(JSON.stringify(meta.paths) === JSON.stringify(managed), 'Backup does not match current target');
  for (const p of managed) insist(hash(p) === meta.after[p], `Changed since setup, refusing to overwrite ${p}`);
  for (let n = 0; n < managed.length; n++) copyFileSync(join(argument, String(n)), managed[n]);
  console.log('Restored:', managed.join(', '));
} else if (action === 'prepare') {
  const source = resolve(argument ?? join(import.meta.dir, '../..'));
  const sourceDist = join(source, 'extensions/obsidian-tracker/dist');
  insist(existsSync(join(sourceDist, 'main.js')), 'Build source first: ab check -- bun run extensions/obsidian-tracker/build.ts');
  insist(realpathSync(vault) === realpathSync(join(homedir(), 'obsidian')), 'Vault ownership mismatch');
  const registry = JSON.parse(readFileSync(join(homedir(), 'Library/Application Support/obsidian/obsidian.json'), 'utf8'));
  insist(Object.values(registry.vaults).some((v: any) => v.path === vault), 'Vault is not registered');
  const notes = Bun.spawnSync(['rg', '--follow', '-l', '^\\s*```datacore(?:jsx)?\\s*$', vault, '-g', '*.md']);
  insist(notes.exitCode === 1 && !notes.stdout.length, `Datacore render consumers remain (move/archive consciously first):\n${notes.stdout.toString()}${notes.stderr.toString()}`);
  const text = readFileSync(base, 'utf8');
  const data = YAML.parse(text);
  insist(Array.isArray(data.views) && data.views.some((v: any) => v.type === 'tracker' && v.mode === 'tree') && data.views.some((v: any) => v.mode === 'graph'), 'Unexpected Base; inspect manually');
  insist(!data.views.some((v: any) => v.mode === 'board'), 'Board already exists; inspect manually');
  const enabled = JSON.parse(readFileSync(plugins, 'utf8'));
  insist(Array.isArray(enabled) && enabled.includes('datacore') && enabled.includes('tracker'), 'Unexpected plugin state');
  for (const p of managed) insist(existsSync(p), `Missing rollback input: ${p}`);
  const backup = join(vault, '.obsidian', `tracker-rollout-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(backup);
  for (let n = 0; n < managed.length; n++) copyFileSync(managed[n], join(backup, String(n)));
  // Append only; never round-trip the user's Base, which owns filters, view state and formatting.
  const board = '\n  - type: tracker\n    name: board\n    mode: board\n    groupBy:\n      property: formula.project\n      direction: ASC\n    sort:\n      - property: priority\n        direction: ASC\n';
  writeFileSync(base, text.trimEnd() + board);
  writeFileSync(plugins, JSON.stringify(enabled.filter((p: string) => p !== 'datacore'), null, 2) + '\n');
  for (const f of ['main.js', 'manifest.json', 'styles.css']) copyFileSync(join(sourceDist, f), join(dist, f));
  const after = Object.fromEntries(managed.map(p => [p, hash(p)]));
  writeFileSync(join(backup, 'manifest.json'), JSON.stringify({paths: managed, after}, null, 2) + '\n');
  console.log(`Installed from ${source}; rollback: bun extensions/obsidian-tracker/live-setup.ts rollback '${backup}'`);
  console.log('Open obsidian://open?vault=obsidian&file=projects%2FTracker.base (reload vault to activate changed plugin).');
} else throw Error('Usage: bun extensions/obsidian-tracker/live-setup.ts prepare [source checkout] | rollback /absolute/backup-directory');
