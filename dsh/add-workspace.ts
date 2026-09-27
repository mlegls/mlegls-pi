#!/usr/bin/env bun
/** Add and select a checkout-rooted workspace in this isolated DSH_HOME. */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const root = process.env.DSH_HOME;
const target = process.argv[2];
if (!root || !target) {
  throw new Error("Usage: DSH_HOME=... bun dsh/add-workspace.ts <checkout-path> [title]");
}
const storePath = resolve(root, "storages/workspace.json");
const store = JSON.parse(await Bun.file(storePath).text());
if (store.unit?.name !== "workspace" || !store.global || !store.tables?.workspaces) {
  throw new Error(`Unsupported workspace store schema: ${storePath}`);
}
const path = resolve(target);
const title = process.argv[3] ?? path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
const now = new Date().toISOString();
const id = randomUUID();
store.global.workspaceIds = [...new Set([...store.global.workspaceIds, id])];
store.global.defaultWorkspaceId = id;
store.tables.workspaces[id] = { path, title, sessionIds: [], createdAt: now, updatedAt: now };
await Bun.write(storePath, JSON.stringify(store, null, 2) + "\n");
console.log(JSON.stringify({ id, path, title, selected: true }));
