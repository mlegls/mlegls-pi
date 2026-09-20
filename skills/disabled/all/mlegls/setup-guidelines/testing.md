# Testing

The product argument is in `{STORIES_PATH}` (`stories`). The suite supplies its
`test:` evidence; tests compose as lemmas rather than mirror the implementation.

This project's useful seams and assumptions:

- {CALLER} uses {SEAM}. Realistic sequences through that seam establish product
  behavior; {OUTERMOST_LAYER} smoke evidence connects the outer interface to it.
- {CORE_COMPETENCY} is locally owned. Lemmas about it support the larger claims.
- {UPSTREAM_CONTRACTS} are external guarantees, cited as `ext:` rather than
  re-proven here.

Use `testing` for the method. Its information-first approach also applies to
retaining tests: a product test has a place in the story argument, and a test
whose information no longer matters can go. Trusted declarative translation
need not be tested again at every declaration.

Diagnostic and refactoring experiments can have temporary working arguments
without becoming product stories. When a regression check deserves to stay,
name the invariant or lemma it protects and connect it to the lasting argument.
An invariant-only refactor needs evidence of preservation, not an invented
user-facing feature.

Use the real local equivalent of an external component where available. If an
expensive external system must be mocked, capture real behavior for the fixture.
Expected values come from the argument rather than the implementation under test.

Drive changed {OUTERMOST_LAYER} journeys as acceptance evidence and compare UI
results with the design when applicable. A screenshot from one run need not
become a permanent visual-regression suite.
