# Reader load

What must a fresh maintainer understand at once to make the next real change?
Some useful places to look:

- A decision repeated across files may belong in one table, schema, or type.
- A state kept in sync with another may be derivable, or the representation
  may admit states the domain does not.
- A module is deep when deleting it would scatter complexity into callers.
  Implementation count alone does not determine whether a boundary is useful.
- Unused options and anticipated variants make the reader carry possibilities
  the product does not have.
- A name that cannot identify its object in the theory may expose a missing
  concept rather than a naming problem.

Prefer deletion or a better representation to another layer of explanation.
Report the actual reading or change burden, not merely a matching pattern.
Project conventions and lint output are context, not substitutes for judgment.
