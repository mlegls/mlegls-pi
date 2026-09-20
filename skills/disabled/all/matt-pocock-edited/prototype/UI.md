# UI alternatives in context

A design is easier to judge against the real header, navigation, data, and
page density. Put alternatives on the existing route when there is a natural
home, preserving its data loading and swapping the relevant rendered subtree.
Use a throwaway route when the question genuinely has no home yet.

`?variant=A` makes alternatives shareable and reload-stable. A small floating
switcher keeps comparison quick; stable names let the user ask for B's hierarchy
with C's controls. Arrow-key switching is useful outside editable fields.

Vary structure, information hierarchy, or the primary interaction (`variety`).
The surrounding design system can stay fixed. Several recolored versions of
one layout usually do not answer a design question.

Use real read-only data where helpful and isolated state for mutations. The
prototype lives outside production; a permanent switcher or feature flag is
not part of the result. `artboard` is a simpler choice when static frames would
answer the question without modifying app code.

Capture the chosen direction and why, retaining alternatives only where they
remain useful evidence. [prototype](SKILL.md) describes the handoff.
