---
name: tracker
description: "Use when reading or writing issues: formats, lifecycle, assignment, dependencies, and the tracker adapters."
---

Tracker operations are global across checkouts and branches; read and write through the selected backend, not worker files or `git show`. Code and `docs/attachments/` evidence stay on worker branches. Claims, relations, decisions, contract sharpening and friction are immediate tracker writes. Reconciled completion waits for code to reach the owner's target, not a report or collector landing.

A friction report records what you tried, what happened and the workaround, with observations kept apart from proposed improvements. Reuse an existing owner where one exists. Another project's tooling is filed in its tracker when accessible, otherwise here, naming the owning tool or repository.

A `docs/issues/` directory in the git common dir's main worktree (or an upward-discovered non-git directory) means the [vault](references/issue-tracker-vault.md) adapter; it defines the model. public repos use [GitHub](references/issue-tracker-github.md) or [GitLab](references/issue-tracker-gitlab.md) with the same model over labels, and a [PR](references/pr.md) to land. a repository's own conventions win.
