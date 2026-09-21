import { homedir } from "node:os";
import { join } from "node:path";

export interface ReaderConfig {
  systemPrompt: string;
  submission?: { extension: string; tool: string };
}
export interface ReaderResult {
  text: string;
  sessionFile: string;
  submission?: unknown;
  error?: string;
}

// Same-host IPC: BB forks stay on the source machine. Keep configuration for resumed readers.
export function readerFiles(threadId: string) {
  if (!/^thr_[a-zA-Z0-9]+$/.test(threadId)) throw new Error("autoread: invalid BB thread ID");
  const dir = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "autoread", threadId);
  return { dir, config: join(dir, "config.json"), request: join(dir, "request.md"), result: join(dir, "result.json") };
}

/** Restate the child boundary at the current request, after inherited parent messages. */
export function readerRequest(request: string): string {
  return "Current request to YOU, the autoread child (the parent conversation and exec state are not your running session):\n\n" +
    request + "\n\nAnswer this request now; do not promise to wait for preparation.";
}
