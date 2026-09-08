---
status: accepted
---

# Chat Threads belong to the Document row, not to a content version

A Document is identified by content fingerprint, and when the file at a known path is
replaced with different content the same row keeps its id and takes the new
fingerprint. The reading position is keyed by id plus fingerprint and is discarded on
that change, following the spec's "different content does not inherit that history".
Chat Threads deliberately do not follow that rule: they reference the Document id
alone and survive a content change.

## Why

Re-exporting a PDF with a small fix is routine, and losing every chat about it would
read as data loss rather than as protection from stale context. Nothing in a Chat
Thread quotes page content that could become misleading; when Context Attachments
arrive they carry their own quote and page range and remain self-describing even if
pages shift.

## Consequences

The spec's acceptance criterion 11 was amended: replacing content resets the reading
position but keeps the Document's Chat Threads. A Document that is missing or
unreadable still lists its Chat Threads, and they remain fully usable, because chat
never needs the PDF bytes.
