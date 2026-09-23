/** Where workers run and child messages go. PI_EXECUTION_HOST=paseo|wm chooses, so a pi started
 * outside Paseo can still dispatch to it; otherwise Paseo inside a Paseo agent, else standalone wm/board. */
export function executionHost(env: NodeJS.ProcessEnv = process.env): "paseo" | "wm" {
  const chosen = env.PI_EXECUTION_HOST;
  if (chosen === "paseo" || chosen === "wm") return chosen;
  return env.PASEO_AGENT_ID ? "paseo" : "wm";
}
