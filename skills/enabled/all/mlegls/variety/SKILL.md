---
name: variety
description: "Use when the user asks for variety: techniques for independent alternatives and diverse candidates."
disable-model-invocation: true
---

some techniques for getting diverse responses from the same prompt/context (Ashby: the reviewer needs requisite variety):

- use different model families if available
- first generate a nonce via a password/key generator to seed the context
- model selection as a decision tree. first generate a list of choices, then use a real external rng to select from those choices. iterate until reaching a specific candidate

these are especially useful for getting different results from independent sessions (eg for reviews). if you're generating diverse candidates within your own session, just coming up with multiple options is often enough, but these techniques are still helpful for countering biases like narrative coherence or position bias (a clearly best option first or last).
