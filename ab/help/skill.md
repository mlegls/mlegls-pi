ab skill PATH|NAME

Load a SKILL.md (or its directory), expanding its dynamic shell placeholders once,
with PI_SKILL_DIR and PI_WORKSPACE set. A bare name resolves from the current directory
first, then ~/.pi/agent/skills. Explicit paths are used as given. Relative references
in the skill resolve from PI_SKILL_DIR; workspace commands run in PI_WORKSPACE.
