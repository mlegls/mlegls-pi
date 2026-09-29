---
stage: idea
author: session:01a0e388-0e23-71e2-ad01-d5a2fabefbfb
---

The [[projects/concept/attachments/story-tests-log-react-key-and-act-warnings/drive|independent Storybook drive]] reports that chrome-devtools-axi rejected Draft states button refs as stale twice after fresh snapshots. Inspecting the DOM and clicking the stable `#paid-use-draft-states` selector worked, with no duplicate action. The browser remained usable and all required stories rendered.

Owner: chrome-devtools-axi. Was Storybook mutating the navigation between snapshot and action, or was ref lifetime shorter than intended? Preserve stale-ref protection; investigate only whether the fresh-snapshot workflow can reliably complete this navigation. This observation does not establish a product rendering defect.
