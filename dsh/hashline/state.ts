import type { ToolExecution } from '@deepseek-ai/dsh-tools';
import { Ledger } from '../../lib/outline-read/ledger';

// Plugins are independently bundled; one process-wide registry shares anchor identities
// between hashline reads, direct edits and ast-grep transforms for the same live agent.
const key = Symbol.for('mlegls.dsh.hashline.ledgers');
const host = globalThis as typeof globalThis & { [key]?: WeakMap<object, Ledger> };
const ledgers = host[key] ??= new WeakMap<object, Ledger>();

export function state(exec: ToolExecution) {
  if (!exec.agent) throw new Error('Hashline tools require an agent');
  let ledger = ledgers.get(exec.agent);
  if (!ledger) ledgers.set(exec.agent, ledger = new Ledger());
  return { ledger, cwd: exec.agent.session.header.cwd ?? process.cwd() };
}
