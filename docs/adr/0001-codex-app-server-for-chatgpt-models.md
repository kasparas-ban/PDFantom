---
status: accepted
---

# Reach ChatGPT models through the Codex app-server, not the Codex CLI's exec mode

PDFantom lets a Student use OpenAI models by borrowing a **Codex Session** — a Codex
CLI already installed and logged in on their Mac — rather than asking for another
Provider Credential. Two Codex interfaces could carry that traffic. We chose the
long-lived `codex app-server` process, speaking JSON-RPC over stdio, with one Codex
thread per Conversation.

## Considered Options

**`codex exec --json` (rejected).** The obvious choice: a boring, stable, documented
subcommand, spawned once per turn, emitting JSONL. We prototyped it and it fails the
product on its first requirement. Measured against codex-cli 0.152.0:

- **It does not stream.** The full event sequence for a 200-word answer is
  `thread.started → turn.started → item.completed (entire text) → turn.completed`.
  There are no text deltas and no feature flag that adds them. PDFantom's chat is
  built on incremental rendering; a ChatGPT turn would show an empty bubble for
  several seconds and then a wall of text.
- **It cannot be told to stop being a coding agent.** Every turn carries Codex's
  agent system prompt and built-in tool schemas: 16,929 input tokens to answer "in
  two sentences, what is osmosis?"
- **It inherits the Student's Codex configuration.** Our first probe silently
  connected to the developer's work MCP servers. `--ignore-user-config` suppresses
  this, but the default is to leak.

**`codex app-server` (chosen).** Experimental, but it answers each of those:
`AgentMessageDeltaNotification` streams text; `ThreadStartParams.baseInstructions`
replaces Codex's agent prompt with PDFantom's own; per-thread `config` scopes
configuration instead of inheriting it; `TurnInterruptParams` implements Stop;
`model/list` supplies a live, per-account Model Catalog so we hardcode no model ids;
and `GetAuthStatusResponse.authMethod` tells us a Codex Session exists. Client-side
tools arrive over the same connection as `item/tool/call`, which is how PDFantom will
later expose document tools (chapter lookup, OCR) without running an MCP server.

## Consequences

We are coupled to an interface Codex marks `[experimental]`, on a binary the Student
updates independently of PDFantom. We accept this and contain it: probe
`codex --version` at startup, require a known-good minimum, and when it is missing,
too old, or unauthenticated, mark the ChatGPT Models unavailable through the
existing `ChatModelOption.unavailableReason` affordance rather than failing at send
time. We do not bundle a Codex binary; the Codex Session belongs to the Student.

PDFantom must also locate the binary itself. A packaged `.app` launched from Finder
has `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, which contains no plausible Codex install,
so `spawn("codex")` would work in development and fail in every shipped build. We
probe an ordered list of known install roots — Settings override, `CODEX_HOME`,
`~/.codex/packages/standalone/current/bin`, `~/.local/bin`, Homebrew prefixes, then
`PATH` — and deliberately do **not** resolve `PATH` by spawning the Student's login
shell. That popular Electron workaround executes arbitrary shell startup files inside
an application whose renderer is otherwise fully sandboxed, and it can hang on an
interactive rc file. Students with unusual layouts use the Settings override.
