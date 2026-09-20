# Triage labels

The second column maps shared roles to this tracker's vocabulary. Reuse local
labels rather than creating synonyms.

| Role | Tracker label | Meaning |
|---|---|---|
| `bug` | `bug` | Observed incorrect behavior |
| `enhancement` | `enhancement` | Requested capability |
| `needs-triage` | `needs-triage` | Needs evaluation |
| `needs-info` | `needs-info` | Waiting on missing information |
| `ready-for-agent` | `ready-for-agent` | Specified for an unattended agent |
| `ready-for-human` | `ready-for-human` | Next action requires a human |
| `wontfix` | `wontfix` | Will not be actioned |
| `difficult` | `difficult` | Harder than the behavior should warrant |
| `wayfinder:map` | `wayfinder:map` | An effort's destination and decision index |
| `wayfinder:<method>` | `wayfinder:<method>` | Hole filled by `research`, `prototype`, `grilling`, or `task` |

Category, triage state, difficulty, and fill method are separate dimensions.
Ownership and blockers come from the tracker relations, not additional states
in this table. See [work.md](work.md).
