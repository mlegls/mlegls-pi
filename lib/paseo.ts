// Native SDK boundary. No scheduler, enrollment, or mailbox state.
import { randomUUID } from "node:crypto";
import { createPaseoClient, type PaseoClient, type PaseoClientConfig, type PaseoWorkspace, type PaseoAgent } from "@getpaseo/client";

export class PaseoError extends Error {
  constructor(message: string, readonly receipt: unknown) { super(message); this.name = "PaseoError"; }
}

/** Local desktop daemon by default; remote/custom hosts require an explicit URL. */
export async function connect(options: Partial<PaseoClientConfig> = {}): Promise<PaseoClient> {
  const client = createPaseoClient({
    url: process.env.PASEO_URL || "ws://127.0.0.1:6767/ws",
    password: process.env.PASEO_PASSWORD || undefined,
    connectTimeoutMs: 10_000,
    reconnect: { enabled: false },
    ...options,
  });
  try { await client.connect(); return client; }
  catch (error) { await client.close().catch(() => {}); throw error; }
}

/** Closing a connection does not stop agents or archive their workspaces. */
export async function withClient<T>(use: (client: PaseoClient) => Promise<T>, options: Partial<PaseoClientConfig> = {}): Promise<T> {
  const client = await connect(options);
  try { return await use(client); } finally { await client.close(); }
}

export interface Workspace { workspaceId: string; cwd: string; isolation: string; snapshot: PaseoWorkspace | null }
export interface Agent { agentId: string; cwd: string; status: string; provider: string; snapshot: PaseoAgent | null }
export interface Launch { workspace: Workspace; agent: Agent }

export async function launch(task: { handle: string; model: string; effort: string; base?: string; connectome?: string },
    text: string, options: { run: string; cwd: string; parent?: string }): Promise<Launch> {
  let workspace: Workspace | undefined;
  let agent: Agent | undefined;
  const requests = { workspace: randomUUID(), agent: randomUUID() };
  const title = options.run + "/" + task.handle;
  try {
    return await withClient(async client => {
      const nativeWorkspace = await client.workspaces.create({
        requestId: requests.workspace,
        source: { kind: "worktree", cwd: options.cwd, action: "branch-off", branchName: title,
          ...(task.base ? { baseBranch: task.base } : {}) },
      });
      const snapshot = nativeWorkspace.current();
      workspace = { workspaceId: nativeWorkspace.id, cwd: nativeWorkspace.directory ?? "",
        isolation: snapshot?.workspaceKind ?? "", snapshot };
      if (!workspace.workspaceId || !workspace.cwd || workspace.isolation !== "worktree")
        throw new Error("incomplete workspace receipt");
      const nativeAgent = await nativeWorkspace.agents.create({
        requestId: requests.agent,
        config: { provider: "pi/" + task.model, thinkingOptionId: task.effort === "none" ? "off" : task.effort },
        parent: (options.parent ?? process.env.PASEO_AGENT_ID) || undefined, title, prompt: text,
        // Dispatched agents are task-scoped: their own per-session life unless the task names one.
        // Explicit, so a project's connectome.identity doesn't pull every worker into a shared life.
        env: { PI_CONNECTOME: task.connectome ?? "@session" },
      });
      agent = { agentId: nativeAgent.id, cwd: nativeAgent.cwd ?? "", status: nativeAgent.status ?? "",
        provider: nativeAgent.current()?.provider ?? "", snapshot: nativeAgent.current() };
      if (!agent.agentId || !agent.cwd || !["initializing", "running", "idle"].includes(agent.status) || agent.provider !== "pi")
        throw new Error("incomplete or unsuccessful agent receipt");
      return { workspace, agent };
    });
  } catch (error) {
    throw new PaseoError("Paseo launch uncertain; inspect retained resources before retrying: " + String(error),
      { workspace, agent, requests, title, cwd: options.cwd, cause: error instanceof PaseoError ? error.receipt : String(error) });
  }
}

export async function archive(workspaceId: string) {
  return withClient(async client => {
    const result = await client.workspaces.archive(workspaceId);
    // The SDK returns daemon archive errors as data rather than rejecting.
    if (result.error || result.workspaceId !== workspaceId || !result.archivedAt)
      throw new PaseoError("Paseo workspace archive failed; inspect before retrying", result);
    return result;
  });
}
