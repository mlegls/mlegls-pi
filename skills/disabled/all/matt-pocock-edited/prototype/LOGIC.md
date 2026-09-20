# A state model you can play with

One self-contained HTML file lets a non-developer discover “that shouldn't be
possible” without installing a toolchain. The state model is the experiment;
the page makes its consequences visible.

- State the question on the page in domain language.
- Keep the model separate from the DOM. A reducer, state machine, functions,
  or owned state can each be the right representation.
- Show the full relevant state after each action, in readable fields rather
  than only a JSON dump.
- Offer free play and guided scenarios. A walkthrough resets to a known state
  and makes each step an actual action the reader can take.

The awkward cases are often the most useful scenarios. The interface should
make those states easy to reach and compare. Inline HTML/CSS/JS keeps the demo
portable; a real external boundary belongs only when it is the question.

Return the learned decision and a runnable source, following [prototype](SKILL.md).
The model may be worth reusing; the demonstration shell usually is not.
