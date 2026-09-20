import { readFileSync } from "node:fs";
import type { RpcClient } from "@earendil-works/pi-coding-agent";

export interface Workflow {
  model: string;
  effort: Parameters<RpcClient["setThinkingLevel"]>[0];
}

/** Workflow policy is editable without restarting a running exec kernel. */
export function workflow(name: string): Workflow {
  const workflows: Record<string, Workflow> = JSON.parse(
    readFileSync(new URL("../workflows.json", import.meta.url), "utf8"),
  );
  if (!Object.hasOwn(workflows, name)) throw new Error(`Unknown workflow configuration: ${name}`);
  return workflows[name];
}
