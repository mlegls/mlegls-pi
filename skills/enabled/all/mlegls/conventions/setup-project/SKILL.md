---
name: setup-project
description: "Use when asked to set up project instructions, document layout, tracker conventions, or lint configuration."
disable-model-invocation: true
---

1. Inspect the existing agent entry file, docs map, tracker, and checks.
2. Fill the missing project-specific account using
   [project facts](references/project.md).
3. Use `project-docs` for the docs map and document formats. Use `tracker` for
   work conventions. For a remote tracker, copy its adapter, work model, and
   label mapping into `docs/agents/` where those documents are missing. For
   the vault adapter, create `docs/issues/` and symlink it as
   `~/obsidian/projects/<repo>` → `docs/`; nothing is copied into the project.
4. Integrate the selected [lint configurations](references/lints.md) into the
   existing checks.
5. Link the resulting docs from the existing entry file, or `AGENTS.md` for a
   new setup. A `CLAUDE.md` that already serves this role can keep doing so.

A partial setup installs only the requested parts. Documents and tracker
configuration are ordinary project files, editable without rerunning setup.
