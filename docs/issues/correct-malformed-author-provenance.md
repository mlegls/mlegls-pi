---
stage: "idea"
assignee: "human"
author: "session:01a19a56-683b-72e7-b6ac-c4125d3835a8"
priority: 4
---
Split from [[projects/mlegls-pi/issues/tracker-accepts-empty-session-provenance-and-refuses-correction]], which rejects empty-suffix authors from now on. Two questions remain there:

- correction: `author` is immutable, so a record already committed with `author: session:` (Concept `26e20a37`) can only be fixed by editing the canonical file by hand. Should the tracker offer a deliberate correction (e.g. `update --correct-author` allowed only when the stored value is malformed), or is a hand edit with a commit naming the reason the accepted path?
- cause: managed `process` commands expanded `$PI_SESSION_ID` to empty twice (sessions `01a1661a-bb76-7763-9c9f-43f21e4a4b41`, `01a17934-ede2-76e3-b242-96aa800e7990`) while `bash` in the same session had it. Unexplained; possibly related to [[projects/mlegls-pi/issues/managed-process-nested-shell-loses-mise-python-path]]. An agent can investigate this part before the session that decides the first.
