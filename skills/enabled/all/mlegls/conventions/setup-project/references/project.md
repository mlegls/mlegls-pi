# Project facts

An agent entry file links the docs map and tracker mechanics and records the
project-specific facts needed to work here:

```markdown
## Project

{CORE_COMPETENCY}

{ACTUAL_CONSUMERS_AND_COMPATIBILITY_PROMISES}

## Commands

- Setup: `{SETUP_COMMAND}`
- Checks: `{CHECK_COMMAND}`
- Tests: `{TEST_COMMAND}`

## Testing

{PUBLIC_CALLER_SEAMS_AND_LOCAL_TEST_ENVIRONMENT}

## Documents

`docs/theory.md`, `docs/concepts/`, and `docs/stories/`;
`docs/README.md` maps contexts when there are several.
The `project-docs` skill describes their formats.

## Tracker

{TRACKER_AND_PROJECT}
`docs/agents/issue-tracker.md` records a remote tracker's mechanics; a vault
project has `docs/issues/` and nothing to record.
The `tracker` skill provides work-item and PR formats.
```

Omit absent sections. Core competency records what the project owns;
compatibility records promises to actual consumers. Testing records commands,
seams, and environment facts. These slots hold project facts rather than a
shared engineering methodology.
