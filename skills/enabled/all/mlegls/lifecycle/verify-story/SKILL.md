---
name: verify-story
description: "Use to check that the product does what a story claims: drive it as its user would and record what you observe."
argument-hint: "a story ID, a subtree, or the whole tree"
---

1. Read the stories in scope; the guide each cites is the script, its
   steps block says what the guide leaves out, its checks note what to look
   at on the way.
2. Be the persona, as the personas doc says, and follow the guide through
   the persona's surface: CLI, browser, API, or importing code. Look at the
   join, not at every step.
3. Record what you observe in the story's argument, with the date. A
   counterexample is stated there and becomes an issue with reproduction
   steps. A step the guide got wrong is corrected in the guide; a step the block got wrong, in the block.
4. Report the claims driven, which held, and what could not be observed and why.
   Distinguish a counterexample to the claim being driven from another problem noticed along the way.
