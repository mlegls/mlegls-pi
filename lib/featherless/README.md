# Featherless

Loads the public Featherless catalogue at startup, including for `pi --list-models featherless`. Set `FEATHERLESS_API_KEY`, restart pi (or `/reload`), and select with `/model`.

Caches the catalogue for 24 hours in `~/.pi/agent/cache/featherless-models.json` (respects `PI_CODING_AGENT_DIR`). Delete the file and reload to refresh immediately. Discovery times out after 30 seconds and falls back to stale cached models; without a cache, failures appear as exec host-module errors at session startup.

Context limits and token prices come from the catalogue. Missing output limits default to 4096, capped by context size. Prices exclude subscriptions. The public catalogue includes models unavailable on some plans; plan-specific context caps are not applied. Not all models support tools. Input is text-only and reasoning controls are disabled because the catalogue does not describe them.
