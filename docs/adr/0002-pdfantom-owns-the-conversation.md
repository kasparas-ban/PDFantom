---
status: accepted
---

# PDFantom owns the Conversation; the Codex Thread is a disposable cache

Reaching ChatGPT Models through the Codex app-server means Codex holds conversation
state of its own, so two components could claim to own a Conversation. PDFantom owns
it. A Codex Thread is an ephemeral, rebuildable projection of a Conversation that
PDFantom already holds, and it is discarded freely.

## Why the obvious alternative does not work

The pattern used for OpenRouter — stay stateless, resend the whole message array
every turn — cannot be reproduced here. `TurnStartParams.input` takes
`Array<UserInput>`, and `UserInput` has no role field: its variants are text, image,
localImage, audio, localAudio, skill and mention. There is no way to replay an
alternating user/assistant transcript as structured turns. Resending history would
mean flattening the Conversation into a single text blob and losing every role
boundary, on every turn.

So a Codex Thread must outlive a turn, and the ownership question becomes real.

## What we do

One ephemeral Codex Thread per Conversation, created lazily on the first ChatGPT
turn. Normal turns send only the new message and let Codex hold the structure, which
is where correct roles and prompt caching live. Switching Model mid-Conversation is
not a rebuild — `TurnStartParams.model` overrides per turn.

A rebuild — a fresh Thread seeded with the prior transcript flattened into its first
input — happens on app restart, message edit, regenerate, or app-server crash. The
flattening we were trying to avoid still exists, but as a rare recovery path rather
than the steady state.

The main process tracks which message id its Thread last saw and rebuilds whenever
that disagrees with what the renderer sends. Divergence between the two
representations is thereby detected structurally rather than assumed not to happen.

## Consequences

`ThreadStartParams.ephemeral` must be true. Without it Codex writes session files
into `~/.codex`, which would put a Student's PDF conversations in their `codex
resume` picker alongside their coding work, and would place study history somewhere
other than the SQLite database that is supposed to hold all of it. Both contradict
promises the product spec makes.

The cost is that a Conversation has two representations that can disagree. We accept
it because the alternative — Codex owning study history — is worse, and because the
mismatch is made detectable rather than left implicit.
