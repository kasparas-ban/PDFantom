---
status: accepted
---

# Persist an Assistant Message once, when its stream settles

Streamed replies pass through the main process as deltas, so the main process could
write them to SQLite as they arrive. We instead write nothing until the renderer
reports the message as settled: complete on done, incomplete on Stop, incomplete with
the error text on failure. Provenance and usage arrive only in the done event and are
written at the same time. User messages are written when sent, in the same
transaction that creates the Chat Thread if it is the first one.

## Why

Writing every delta turns a short reply into hundreds of SQLite writes for no
User-visible benefit. The renderer is where Stop, Regenerate, and future edit
decisions are made, so it would have to tell the main process about them regardless;
making it the single reporter of message state keeps one owner of the transcript.

## Consequences

A crash mid-stream loses the partial Assistant Message. The Chat Thread reopens ending
in the User's message, and the existing Regenerate action recovers. Queued messages
are renderer-only until their turn actually starts, so they are also lost on crash.
