import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

for (const profile of ['headless', 'web']) test(`combined ${profile} overlay mounts each capability once`, () => {
  const root = resolve(import.meta.dir);
  mkdirSync(join(root, '.local'), { recursive: true });
  const home = mkdtempSync(join(root, '.local/overlay-test-'));
  try {
    const proc = Bun.spawnSync([join(root, 'node_modules/.bin/dsh'), '--profile', profile,
      '--patch', join(root, 'cordis.yml'),
      ...(profile === 'headless' ? ['--patch', join(root, 'cordis.headless.yml')] : []), '--dump-config'],
      { env: { ...process.env, DSH_HOME: home }, stdout: 'pipe', stderr: 'pipe' });
    expect(proc.exitCode).toBe(0);
    const rows = parse(proc.stdout.toString(), { logLevel: 'silent' });
    for (const id of ['hashline', 'transform', 'scratch', 'memory', 'skim', 'board', 'spill-local', 'tool-session-query', 'agent-preset-registry']) {
      const matches = rows.filter((r: any) => r.id === id);
      expect(matches.length).toBe(1);
      expect(matches[0].disabled ?? false).toBe(false);
    }
    for (const id of ['tool-fs', 'spill-policy', 'tool-result-pruner', 'compaction-basic', 'fs-observation-policy']) {
      expect(rows.find((r: any) => r.id === id)?.disabled).toBe(true);
    }
  } finally { rmSync(home, { recursive: true, force: true }); }
});
