import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import { apply } from './index';

function harness(dir: string) {
  const tools = new Map<string, any>();
  let post: any;
  let writes = 0;
  apply({
    tools: { register(t: any) { tools.set(t.name, t); } },
    on(_name: string, fn: any) { post = fn; },
    sessions: { async flush() { return true; } },
    spillStore: { async saveText({ content }: any) {
      const locator = join(dir, `${++writes}.txt`);
      await writeFile(locator, content);
      return { locator, bytes: Buffer.byteLength(content), retrievalHint: 'read' };
    } },
    logger: { warn() {} },
  } as any);
  return { tools, post, writes: () => writes };
}

test('truncation retains original once; replay/fork pull stays exact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-skim-review-'));
  try {
    const host = harness(dir);
    const session = Session.create(SessionId('skim-parent'));
    const agent = { session };
    const exec = { agent, name: 'run_code', callId: 'outer', arguments: { code: 'print exact diff', description: 'diff' } };
    // Large results retain an exact original without an external judge.
    const original = 'diff --git a/x b/x\n' + '+retained marker\n'.repeat(8000);
    const result = { content: [{ type: 'text', text: original }], isError: false };
    const decision = await host.post(exec, result, async () => ({ kind: 'accept' }));
    expect(decision.content[0].text).toContain('Grep this file');
    expect(Buffer.byteLength(decision.content[0].text)).toBeLessThanOrEqual(4096);
    const id = decision.content[0].text.match(/ing-[a-f0-9]{16}/)[0];
    expect(host.writes()).toBe(1);
    expect(session.snapshotEvents().filter(e => e.type === 'skim/retained').every(e => e.ignorable)).toBe(true);
    await host.post(exec, result, async () => ({ kind: 'accept' }));
    expect(host.writes()).toBe(1);
    for (const name of ['skim-parent', 'skim-fork']) {
      const seed = session.snapshotEvents();
      const fork = name !== session.id;
      const restored = { session: Session.create(SessionId(name), seed,
        { ...session.header, id: SessionId(name), isSeeded: fork, ...(fork ? { parentSession: session.id } : {}) },
        fork ? seed.length as any : undefined) };
      const freshHost = harness(dir);
      const pull = await freshHost.tools.get('pull').execute({ id }, { agent: restored, rootCallId: 'recall' });
      expect(pull).toBe(original);
      const raw = { kind: 'accept' };
      expect(await freshHost.post({ ...exec, agent: restored, callId: 'recall' }, result, async () => raw)).toBe(raw);
      expect(freshHost.writes()).toBe(0);
    }
    const stranger = { session: Session.create(SessionId('stranger')) };
    await expect(host.tools.get('pull').execute({ id }, { agent: stranger })).rejects.toThrow('Unknown ingress page');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
