import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { act, blocks, blockAt, writeBack } from './vault.ts';
export { blockAt, insertComment } from './vault.ts';

async function main() {
  const [command, path, caret, lens] = process.argv.slice(2);
  if (command !== 'comment' || !path || !isAbsolute(path) || !/^\d+(?::\d+)?$/.test(caret ?? '')) {
    throw new Error('Usage: bun lib/augment.ts comment <absolute note path> <one-based line[:column]> [lens]');
  }
  const note = readFileSync(path, 'utf8');
  const selected = blockAt(note, Number(caret.split(':')[0]));
  const block = blocks(note).find(b => b.start === selected.start) ?? { ...selected, tag: 'question' };
  const result = await act(block, note, lens);
  if ('declined' in result) console.log(`Declined: ${result.declined}`);
  else console.log(JSON.stringify(writeBack(path, block, result)));
}

if (import.meta.main) main().catch(error => { console.error(`augment: ${error.message}`); process.exitCode = 1; });
