---
name: testing
description: "Use when writing, editing, auditing or deleting tests."
---

The baseline is no tests. A test earns its place only if it asserts an externally depended-on behavior of a nontrivial algorithm that could plausibly change in response to future demands.

- Externally depended on: its consumers are outside a change's view (people, persisted data, published artifacts, network APIs, a package's public operations). Inside the view, the author, reviewer and typechecker see both sides.
- Nontrivial algorithm: not a declaration interpreted by a trusted system. If you trust React and HTML, the element you wrote is there; if you trust Convex, a mutation that throws writes nothing; an explicitly written exception clause is a declaration. At most, one smoke test that the whole system is connected.
- Could plausibly change: a future demand could make someone rewrite it unknowingly. A bug that happened once is not such a reason; its fix is in the code for everyone to notice. Where a fix looks deletable, prefer making the mistake unrepresentable, then a comment stating why.

A test may assert that a mechanism has the behavior its author expects. It may not assert one decision over a different viable decision: having chosen between alternatives often means the other was viable, and we might change to it. Assert absence only when our own code produces it (a filter), never behavior nobody wrote.

Many similar-flavored assertions across different consumers are a smell: extract the declarative system they share, test it once as a mechanism, and trust it.

How a kept system is tested can change: scenarios, property tests against a naive reference, a model test over interleavings, formal verification. Prefer one property over many scenarios.

Adding a test needs the maintainer's explicit approval; the change lands without it. Propose it in the ticket result as one sentence naming the property and the system, not as code. Weakening or removing a kept assertion is a change of intent too: say so in the result.
