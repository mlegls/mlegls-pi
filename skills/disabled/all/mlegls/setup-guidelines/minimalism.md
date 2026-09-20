# Minimalism policy template

```markdown
{PROJECT}'s core competency is {CORE_COMPETENCY}. Product behavior is described
in `{STORIES_PATH}`. Outside that competency, maintained libraries are usually
better than locally owned subsystems; tiny local code can still be cheaper
than a dependency.

{COMPATIBILITY_POLICY}
```

The compatibility paragraph states a real promise to users or published
consumers. With none, changes can be made directly as if the new design had
always been used. Disposable data does not justify a permanent migration
framework. Existing valuable data still needs an explicit disposition.
