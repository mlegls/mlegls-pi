---
stage: "idea"
assignee: "agent"
author: "session:thr_ihbpyrp6s2"
---

On 2026-11-17, commits `0d59e4690` and `a2ae20e40` in concept, both titled "tracker: update …", deleted the whole body of `verify-full-5000-card-profile-opening` and `joined-5000-profile-practice-and-map-stay-loading`. Only the front matter survived. They came 7 seconds apart while the verify-full worker was "updating both issues without closing them", so an update given an empty or missing body most likely wrote it verbatim. The supervisor restored the bodies from the parent commits (`46467165b`). An update should refuse to replace a non-empty body with an empty one unless asked to explicitly.
