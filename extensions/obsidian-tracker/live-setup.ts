// bun live-setup.ts prepare [source checkout] | rollback /absolute/backup-directory
// The installed plugin directory remains the canonical checkout's dist symlink.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

const vault = join(homedir(), 'obsidian');
const canonical = join(homedir(), 'dev/mlegls-pi');
const base = join(vault, 'projects/Tracker.base');
const plugins = join(vault, '.obsidian/community-plugins.json');
const workspace = join(vault, '.obsidian/workspace.json');
const dist = join(canonical, 'extensions/obsidian-tracker/dist');
const assets = ['main.js', 'manifest.json', 'styles.css'].map(f => join(dist, f));
const managed = [base, plugins, ...assets, ...(existsSync(workspace) ? [workspace] : [])];
const bytes = (p: string) => readFileSync(p);
const hash = (p: string) => createHash('sha256').update(bytes(p)).digest('hex');
function insist(ok: unknown, why: string): asserts ok { if (!ok) throw Error(why); }
const route = join(vault, '.obsidian/plugins/tracker');
insist(realpathSync(route) === realpathSync(dist), `Refusing unexpected plugin target: ${route}`);
const [action, argument] = process.argv.slice(2);
if (action === 'rollback') {
  insist(argument && resolve(argument).startsWith(join(vault, '.obsidian/tracker-rollout-')), 'Provide this vault\'s rollout backup path');
  const meta = JSON.parse(readFileSync(join(argument, 'manifest.json'), 'utf8')) as { paths: string[]; after: Record<string,string> };
  insist(meta.paths.length >= 5 && meta.paths.every(p => managed.includes(p)), 'Backup does not match current target');
  // Restore only what prepare changed. Obsidian rewrites workspace.json on every close and the Base as views are used,
  // so files prepare left alone are not touched, and Obsidian-owned/rebuilt files changed since are kept rather than blocking rollback.
  const kept = new Set([workspace, ...assets]);
  const restore: number[] = [];
  for (let n = 0; n < meta.paths.length; n++) {
    const p = meta.paths[n];
    if (hash(join(argument, String(n))) === meta.after[p]) continue;
    if (hash(p) === meta.after[p]) restore.push(n);
    else if (kept.has(p)) console.log(`Left as is (changed since setup): ${p}`);
    else insist(false, `Changed since setup, refusing to overwrite ${p}`);
  }
  for (const n of restore) copyFileSync(join(argument, String(n)), meta.paths[n]);
  console.log('Restored:', restore.map(n => meta.paths[n]).join(', ') || 'nothing (setup changed no managed file)');
} else if (action === 'prepare') {
  const source = resolve(argument ?? fileURLToPath(new URL('../..', import.meta.url)));
  const sourceDist = join(source, 'extensions/obsidian-tracker/dist');
  for (const f of ['main.js', 'manifest.json', 'styles.css']) insist(existsSync(join(sourceDist, f)), 'Build source first: ab check -- bun run extensions/obsidian-tracker/build.ts');
  insist(realpathSync(vault) === realpathSync(join(homedir(), 'obsidian')), 'Vault ownership mismatch');
  const registry = JSON.parse(readFileSync(join(homedir(), 'Library/Application Support/obsidian/obsidian.json'), 'utf8'));
  insist(Object.values(registry.vaults).some((v: any) => v.path === vault), 'Vault is not registered');
  const notes = spawnSync('rg', ['--hidden', '--follow', '-l', '^\\s*`{3,}datacore(?:jsx?|tsx?)?\\s*$|dc\\.require\\(', vault, '-g', '*.md']);
  insist(notes.status === 1 && !notes.stdout.length, `Datacore render consumers remain (inspect and retire consciously first):\n${notes.stdout.toString()}${notes.stderr.toString()}`);
  const text = readFileSync(base, 'utf8');
  const data = YAML.parse(text);
  insist(Array.isArray(data.views) && data.views.some((v: any) => v.type === 'tracker' && v.mode === 'tree') && data.views.some((v: any) => v.mode === 'graph'), 'Unexpected Base; inspect manually');
  const boards = data.views.filter((v: any) => v.mode === 'board');
  insist(boards.length <= 1 && boards.every((v: any) => v.type === 'tracker'), 'Unexpected Board; inspect manually');
  const enabled = JSON.parse(readFileSync(plugins, 'utf8'));
  insist(Array.isArray(enabled) && enabled.includes('tracker'), 'Tracker must already be enabled');
  for (const p of managed) insist(existsSync(p), `Missing rollback input: ${p}`);
  const backup = join(vault, '.obsidian', `tracker-rollout-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(backup);
  for (let n = 0; n < managed.length; n++) copyFileSync(managed[n], join(backup, String(n)));
  // Append only; never round-trip the user's Base, which owns filters, view state and formatting.
  const board = '\n  - type: tracker\n    name: board\n    mode: board\n    groupBy:\n      property: formula.project\n      direction: ASC\n    sort:\n      - property: priority\n        direction: ASC\n';
  if (!boards.length) writeFileSync(base, text.trimEnd() + board);
  if (enabled.includes('datacore')) writeFileSync(plugins, JSON.stringify(enabled.filter((p: string) => p !== 'datacore'), null, 2) + '\n');
  for (const f of ['main.js', 'manifest.json', 'styles.css']) copyFileSync(join(sourceDist, f), join(dist, f));
  if (existsSync(workspace)) {
    const text = readFileSync(workspace, 'utf8');
    const updated = text.replace(/"tracker\/(?:Tracker\.base|Tracker\.md|Graph\.md)"/g, '"projects/Tracker.base"');
    if (updated !== text) writeFileSync(workspace, updated);
  }
  const after = Object.fromEntries(managed.map(p => [p, hash(p)]));
  writeFileSync(join(backup, 'manifest.json'), JSON.stringify({paths: managed, after}, null, 2) + '\n');
  console.log(`Installed from ${source}; rollback: bun extensions/obsidian-tracker/live-setup.ts rollback '${backup}'`);
  console.log('Open obsidian://open?vault=obsidian&file=projects%2FTracker.base (reload vault to activate changed plugin).');
} else throw Error('Usage: bun extensions/obsidian-tracker/live-setup.ts prepare [source checkout] | rollback /absolute/backup-directory');
