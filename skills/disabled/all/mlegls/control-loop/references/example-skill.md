---
name: narrow-react-prop-types
description: Use when narrowing React prop contracts to match live callers.
---

Live callers establish this application's component contract. Tests, demos,
and Storybook adapt to it; their convenience is not a reason to widen the API.
For a published component library, the promised external API is a caller too.

1. Find an optional-heavy prop shape or fallback, then inspect its live uses.
2. Derive the contract: required when every caller supplies it, optional when
   omission has meaning, removed when no live or promised caller uses it.
3. Propagate the narrower contract into child components and support code.
   Delete guards for states the new representation excludes.
4. Typecheck the changed package and its consumers, and verify the affected
   interaction. Follow the repo's delivery workflow.

Absence and emptiness differ. A focus value always supplied but sometimes empty
is `focusedItem: FocusedItem | null`, not an optional prop. An always-rendered
rename action with a required handler can call `onRename(id, name)` directly.
