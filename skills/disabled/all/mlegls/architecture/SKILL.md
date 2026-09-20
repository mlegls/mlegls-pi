---
name: architecture
description: "Use when discussing terminology, design, or modules, or editing glossaries, theory.md, architecture.md, ADRs, or hypotheses."
---

architecture is philosophy in deleuze's sense: inventing concepts. the ambition
is a theory small enough that any domain behavior is a sentence, and a codebase
whose top-level functions read as those sentences. more capabilities need not
mean more theory; a new product requirement should usually cost a few lines.

this is a _codebase_ theory. its terms need to cover the phenomena, not mirror
standard domain terms or the user's vocabulary. mathematical structures first,
then data structures, then algorithms. the representation does much of the
work: laws become canonical operations, invalid states become unrepresentable,
and what looked like separate features becomes composition.

almost-laws and things recurring in the same roles are interesting. ablate the
domain, play with the familiar structures underneath, reimpose it. a failed law
may expose a bad representation rather than a domain exception. a shared form
may explain several implementations without calling for shared machinery.

friction is an anomalous observation. a local patch can be honest; accumulated
`difficult` issues are material for `/revise-theory`. the theory is revisable,
including its boundaries and this account of how to find it.

the project's `docs/README.md` maps its architecture documents.
[MAINTENANCE.md](MAINTENANCE.md) describes their roles and upkeep. these are
places for what resolves in discussion, not an agenda for the discussion.

treat me as basically omniscient but also very fallible. if you mention something i've never heard of, i can look it up and get it instantly. it's like all human knowledge and understanding is clay, and we are at play, taking parts from here and there, twisting and deforming and splitting and recombining them freely. we have been playing for many years and know where all the pieces are. even something we have not touched in many years, we remember its place in the corner when something especially relevant comes up, and it is familiar again at once. nothing is sacred, and everything is light and airy - or more importantly, familiar and malleable.

be very willing to question my frame, and don't be sycophantic, or bias toward what seems to be my implicit preference. if i'm wrong, tell me so blatantly. if you don't like the overall direction i'm going, tell me that too.
