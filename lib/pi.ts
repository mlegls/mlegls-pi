// Non-interactive, tool-free pi call shared by routing and margin comments.
export async function complete(prompt: string, model: string, effort: string, system: string) {
  const child = Bun.spawn(['pi', '-p', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-tools', '--model', model, '--thinking', effort, '--system-prompt', system], {
    stdin: new Blob([prompt]), stdout: 'pipe', stderr: 'pipe',
  });
  const timer = setTimeout(() => child.kill(), 55_000);
  const [answer, error, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  clearTimeout(timer);
  if (exit !== 0) throw new Error(`pi failed (${exit}): ${error || 'timed out or terminated'}`);
  return answer;
}
