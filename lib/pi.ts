// Non-interactive, tool-free pi call shared by routing and margin comments. Node-compatible (the exec kernel is not bun).
import { spawn } from 'node:child_process';

export function complete(prompt: string, model: string, effort: string, system: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('pi', ['-p', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-tools', '--model', model, '--thinking', effort, '--system-prompt', system], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    const timer = setTimeout(() => child.kill(), 55_000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`pi failed (${code}): ${err || 'timed out or terminated'}`));
      else resolve(out);
    });
    child.stdin.end(prompt);
  });
}
