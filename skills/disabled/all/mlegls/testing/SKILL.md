---
name: testing
description: "Use before adding, changing, retaining, or reviewing tests, including test-first work."
---

1. read `docs/agents/testing.md`, or wherever testing guidelines are. suggest using `/setup-guidelines` if there are no testing guidelines.
2. determine what user story argument is currently incomplete or flawed. in natural language, consider how you'd complete/correct the argument.
3. write or edit the corresponding user story argument first. see `/stories`.
4. write the minimal tests necessary to prove the test-evidenced parts of the argument. organize test files parallel to story arguments.
5a. if the tests cannot prove the argument how you expect, go back to 2. and see if you can revise the argument so it can.
5b. if you think the problem is not with argument method but more fundamental, escalate, proposing `/stories` or `/revise-theory`.

- use your own judgement to decide if red-first tdd would be appropriate.
- always test along the appropriate seam for the level of argument. never write tests that mirror the structure of internal implementations, or are otherwise tautological.
- never mock, unless the mocked part is an expensive external component that has no local equivalent. if mocking is absolutely necessary, snapshot real behavior from the external system once, and use this as the mocked payloads.
- tests fill a _gap_ in the argument. in this sense, "declarative" code does not have to be tested, if the declaration-to-behavior translation system is itself trustworthy. this includes if the declarative dsl is a well-known external dependency (e.g., you don't have to test a zod schema).
- in other words, tests are a tool for abstraction. only write a test if you are unsure whether it will pass. tests should compose like lemmas do, in that each should give you the confidence to say bigger and bigger things about the codebase's behavior. 
- give yourself fast feedback loops, and treat tests as a tool for getting information. each is a hypothesis, and running the test tells you if it's true or false. if the information is worthless, so is the test - don't write it, and delete it where you see it.
