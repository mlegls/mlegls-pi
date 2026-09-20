---
name: testing
description: "Use when writing or editing tests."
---

the only assertions worth making are ones a user would notice (even indirectly). a user doesn't care about implementation or read the code. the maintainer, the importing developer, and the programmer are real users; the programmer pretending to be an end user is not.

1. start from a want: something a real user would honestly say. if the code you're testing doesn't figure in one, it shouldn't exist.
2. derive the sequence(s) of affordances that realize the want, then decompose each affordance into program steps.
3. bottom-up: a step test per step, asserting only what that user would notice at that resolution; the sequence test composes the same step utilities and asserts only the join. steps are shared between sequences, so an assertion lives at exactly one level. the end state of one sequence is the fixture the next starts from: derived by the upstream sequence once, then cached (a snapshot where the state serializes), never rebuilt per test. that's the whole suite: sequences, the steps they need, nothing else.

the same at every boundary: if a: x → y and b: y → z, save a real y once; a's test checks it produces that y, b's test consumes the same saved y. that's the only kind of mock: a cached real value, referenced by both sides, whether or not you own a.

when a step can't be called in one line, the missing verb is the finding (GOOS). a project with `docs/stories/` records the want, sequence and steps there (`project-docs`); the tests are the same either way.

- code does what you wrote it to do. a test of something you directly intended is worthless, unless it's an algorithm you're not confident in. a result has to be somewhat surprising to be information. if you wrote something to be isolated, there's no reason to believe it isn't.
- especially no exceptions for "security", "privacy", etc. a behavior you'd "guard" against is one you never wrote. you're a solo maintainer with a deep understanding of what you wrote, and will remember what you meant on sight. write like a solo hacker, not an enterprise employee; this is closer to the reality of llms anyway.
- a test is only worth its information. never write one you 100% know will pass: zero information, a maintenance burden, and a precedent. the same holds for code but is more pernicious in tests, where it's harder to tell what's worth it and "just in case" is tempting. treat every test as if you're writing it in money and blood. if in doubt, don't!
