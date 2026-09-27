import { expect, test } from 'bun:test';
import { Session, SessionId } from '@deepseek-ai/dsh-session';

test('installed session patch preserves every overlay log-only event through JSON replay', () => {
  const session = Session.create(SessionId('overlay-patch'));
  const types = ['board/subscriptions', 'board/cursor', 'board/seen', 'memory/checkpoint', 'skim/retained'];
  // Marker semantics do not depend on payload; plugin contract tests own their shapes.
  for (const type of types) (session.append as any)(type, {}, { ignorable: true });
  const seed = JSON.parse(JSON.stringify(session.snapshotEvents()));
  const restored = Session.create(session.id, seed);
  for (const type of types) expect(restored.snapshotEvents().find(e => e.type === type)?.ignorable).toBe(true);
  expect(restored.surface.nodes).toEqual([]);
});
