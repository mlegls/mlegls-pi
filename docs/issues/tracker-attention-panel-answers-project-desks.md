---
stage: "ticket"
assignee: "agent:auto-routine"
author: "session:01a1cdc8-f756-70d2-9515-c6c42afeff63"
priority: 2
part-of: "[[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]]"
claimed-by: "reconcile:attention-inbox-in-the-bb-tracker"
---
The maintainer can read and answer all projects' desk attention items from the tracker plugin, including supplying credentials to the requested dotenv files. This is the plugin part of [[projects/mlegls-pi/issues/attention-inbox-in-the-bb-tracker]], for [[projects/mlegls-pi/stories/answer-what-agents-ask-of-me]].

## shape

Implement the parent's “the panel, in `~/dev/bb-plugins/tracker`” shape together: [server.ts](../../../bb-plugins/tracker/server.ts) attention/reply RPCs, desk watching, answered records, dotenv writes and grouped queued messages; [app.tsx](../../../bb-plugins/tracker/app.tsx) Attention navigation/badge and the project-grouped Markdown items, recommendation, quoting, per-item reply drafts, ephemeral password inputs, batch Send and collapsed answered state. The parent fixes the file format, reply payload and value lifetime. Keep backend and UI in this one session so their RPC interface is owned together.

Attention covers every project returned by `bb.sdk.projects.list()`, including ones without a vault tracker. The existing `projects()` helper filters to projects with `docs/issues`; its filtered set is insufficient here. Resolve the main checkout for the desk independently of vault presence, and watch newly created desks as well as existing ones.

## tasks

Work in a separate Git worktree of `/home/mlegls/dev/bb-plugins`, on a branch from `main`. Leave its unrelated modified `obsidian-at-home` submodule alone. Commit plugin changes there and return the branch, worktree path and commit IDs, declaring the foreign repository as `{ checkout: /home/mlegls/dev/bb-plugins, commits: [...] }` under the handoff's `commit` key. The supervisor @thread:thr_dfgkcug6jp merges that branch into `/home/mlegls/dev/bb-plugins` main when the completion hold fires; the ticket stays open until that ancestry is present. Remove the foreign worktree after merge, with cleanup ownership retained by the supervisor if the worker has already retired. This landing arrangement was approved by that supervisor on 2026-11-12.

Build the plugin and prepare a runnable live deployment plus disposable-project setup for the parent's combined first use. Record how to load this branch's plugin and restore the previous deployment. The parent owns the complete desk-helper → panel → owner-message → removal drive after both children land; this child should still try its own changed behavior and hand off the setup.
