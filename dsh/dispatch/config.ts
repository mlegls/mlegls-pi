// Preset registry child rows are not rebased with their declaring patch. Resolve
// local plugin names before loading, rather than depending on a profile's cwd.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
const root = fileURLToPath(new URL('../', import.meta.url));
const rows = parse(readFileSync(resolve(root, 'dispatch.yml'), 'utf8'));
function rebase(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if ('name' in value && typeof value.name === 'string' && value.name.startsWith('./')) value.name = resolve(root, value.name);
  for (const child of Object.values(value)) rebase(child);
}
rebase(rows);
const output = resolve(process.argv[2]);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, stringify(rows));
