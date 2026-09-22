/** Host-local substitution. Paseo wins when launched from an Orca-owned shell. */
export function executionHost(env: NodeJS.ProcessEnv = process.env): "paseo" | "orca" | "wm" {
  if (env.PASEO_AGENT_ID) return "paseo";
  if (env.ORCA_WORKTREE_ID || env.ORCA_WORKSPACE_ID) return "orca";
  return "wm";
}
