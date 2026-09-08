# Chat Threads per Document

Each Document owns many Chat Threads, shown as an expandable tree in the documents
panel, in the manner of the Codex desktop app's project list. Vocabulary follows
`CONTEXT.md`: User, Document, Chat Thread, Draft, Assistant Message.

Related decisions: [ADR 0003](../adr/0003-chat-threads-belong-to-the-document-row.md),
[ADR 0004](../adr/0004-persist-assistant-messages-when-the-stream-settles.md),
[ADR 0002](../adr/0002-pdfantom-owns-the-conversation.md) (Codex Thread rebuilds).

## Starting point

- Nothing about a chat is persisted. `ChatSessionOwner` creates one in-memory
  assistant-ui local runtime with a random conversation id for the whole app; it is
  not tied to the active Document.
- SQLite holds `documents` and `application_state` only (`src/main/document-repository.ts`).
  Tables are created with `IF NOT EXISTS`; there is no migration mechanism and, by
  decision, none is added yet.
- The main process allows one in-flight chat request app-wide (`src/main/chat-boundary.ts`).
- The Codex side keys its Codex Threads by the request's conversation id
  (`src/main/codex/session.ts`) and rebuilds on divergence.
- The documents panel is a flat list of buttons (`src/renderer/src/sidebar/documents-panel.tsx`).

## Behaviour

### Sidebar

- Documents ordered by first opened, newest first (unchanged).
- Each Document row: folder icon on the left toggles expand/collapse; clicking the
  name activates the Document and shows its most recently viewed Chat Thread, or its
  Draft when it has none. Hover reveals a "New Chat Thread" button on the right,
  which activates the Document and opens a Draft.
- Expanded state persists per Document across restarts, alongside panel widths.
  Switching to a different Document expands its Chat Threads again, so the selected
  Document always shows its threads unless the folder is collapsed afterwards.
- Chat Thread rows under a Document ordered by last message, newest first. Show the
  five most recent; "Show more" reveals the rest until restart. The active Chat
  Thread is always shown even when outside the first five.
- Clicking a Chat Thread row activates its Document, shows the thread in the chat
  panel, and opens the panel if closed.
- A streaming Chat Thread shows an activity indicator on its row.
- A hover "..." menu on a thread row offers Delete, behind a confirmation dialog.

### Chat panel

- Compact header: Chat Thread title, or "New chat" for a Draft, and a "New Chat
  Thread" button. A keyboard shortcut (Cmd+N if free) does the same.
- No active Document: empty state "Open a PDF to start a chat", composer disabled.
  An unavailable Document still counts as active; its threads work without the PDF.
- Draft: renderer-only composer. The Chat Thread row is created at first send, in
  the same transaction as the first user message.
- Title derived from the first user message: first line, whitespace collapsed,
  truncated to about 60 characters. No rename UI yet; the column exists for it.
- Threads are linear. Regenerate replaces the previous Assistant Message (delete old,
  write new on settle). The branch switcher is not rendered. Edit stays unavailable.
- Each Chat Thread remembers the Model, Model Source, and effort it last used. A
  Draft starts from the global last-selected Model; the global value updates
  whenever the picker changes. A remembered Model missing from the catalog falls
  back to the global selection.

### Streaming and switching

- Switching Document or Chat Thread never cancels a stream. The main process moves
  from one in-flight request app-wide to one per Chat Thread.
- The renderer keeps a runtime alive for the visible thread and for any thread still
  streaming; idle hidden threads are unmounted and reloaded from SQLite on revisit.
- Deleting a streaming thread aborts its request first. Deleting the visible thread
  shows the Document's Draft. The main process also drops that thread's Codex Thread.

### Persistence (see ADR 0004)

- User messages written when sent. Queued messages stay renderer-only until their
  turn starts.
- Assistant Messages written once when the stream settles, with status complete or
  incomplete, error text when failed, and provenance and usage from the done event.
- A crash mid-stream loses the partial reply; Regenerate recovers.
- The renderer is the sole reporter of message state; the main process owns the
  database. The renderer never sees SQLite.

## Schema

Added to the existing database with `CREATE TABLE IF NOT EXISTS`.

```sql
CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  model TEXT,
  model_source TEXT,
  effort TEXT,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  last_viewed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_threads_by_document
  ON chat_threads (document_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete', 'incomplete')),
  error TEXT,
  model TEXT,
  model_source TEXT,
  usage_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (thread_id, ordinal)
);
```

- `last_message_at` is denormalised and updated in the same transaction as each
  message write, so the sidebar query is one indexed read.
- The Document's current thread is `MAX(last_viewed_at)`, updated whenever a thread
  is shown. `last_message_at` orders the sidebar; the two differ when the User
  re-reads an old thread.
- One connection, several repositories: a small database class owns the connection
  and schema creation; `DocumentRepository` and a new `ChatThreadRepository` receive it.

## IPC surface (`src/shared/chat-thread-api.ts`)

Typed channels guarded by `isTrustedRenderer` and zod schemas like the existing
boundaries. Roughly:

- `listChatThreads(documentId)` → thread summaries for the sidebar (id, title,
  last message at, streaming is renderer state, not stored).
- `loadChatThread(threadId)` → thread row plus ordered messages; marks viewed.
- `createChatThread({ documentId, firstMessage, model, source, effort })` → thread
  summary. Derives the title.
- `appendUserMessage`, `appendAssistantMessage`, `replaceAssistantMessage` →
  write on send / settle / regenerate-settle; update `last_message_at` and the
  thread's remembered Model.
- `deleteChatThread(threadId)` → cascade; main also aborts any in-flight request
  for that thread and forgets its Codex Thread.
- `getDocumentLibrary` grows to include per-Document thread summaries, or the
  sidebar calls `listChatThreads` per expanded Document. Prefer the former so one
  snapshot hydrates the tree.

`ChatRequest.conversationId` becomes the Chat Thread id; Drafts send a freshly
generated id that becomes the thread id at first send, so the Codex Thread map needs
no special case.

## Renderer shape

- `reader-session-store` gains `chatThreadsByDocument`, `activeChatThreadId`,
  expanded-Document set (persisted via the app config store), and "show more" set
  (session only).
- `ChatSessionProvider` changes from one owner to a keyed set of `ChatSessionOwner`
  instances: one per thread that is visible or streaming. Each owner takes the
  thread id and initial messages, builds the adapter with that id, and reports
  settled messages through the IPC surface. Owners for idle hidden threads unmount.
- `ChatPanel` renders the active owner's client, or the no-Document / Draft states.
- `DocumentsPanel` becomes a tree: Document row component with toggle, hover
  action, and nested thread rows with indicator and menu.
- Codex transcript flattening (`src/main/codex/conversation.ts`) relabels the
  user's turns from "Student" to "User" when touched.

## Slices

Each leaves a runnable app with tests at the existing seams (Playwright e2e for the
workflow, unit tests for repository and adapter logic).

1. **Persistence and one thread per Document.** Tables, `ChatThreadRepository`, IPC
   surface, renderer reports settled messages, runtime keyed by Document and
   reloaded from SQLite, Draft-at-first-send, derived titles, linear regenerate.
   Visible result: chats survive restart and follow the active Document. Sidebar
   unchanged.
2. **Multiple Chat Threads.** Sidebar tree with expand/collapse and persisted
   expansion, hover "New Chat Thread", thread rows and switching, keyed runtime set
   with background streaming and the row indicator, per-thread Model memory, one
   in-flight request per thread, library snapshot carrying thread summaries.
3. **Finish.** Chat panel header and shortcut, delete with confirmation and stream
   abort, "Show more" with active-thread pinning, no-Document empty state,
   unavailable-Document behaviour verified.

## As built (September 2026)

All three slices landed together. Where the build differs from the plan above:

- **No Document is a detached Draft**, not a separate panel state. The chat runtime
  still mounts, the composer and its send button are disabled, the placeholder and
  empty state read "Open a PDF to start a chat", and the model picker stays usable.
- **Persistence rides assistant-ui's `ThreadHistoryAdapter`**
  (`chat-history-adapter.ts`): the runtime calls `append` for a user message at send
  and for an Assistant Message once it settles, so no custom message subscription
  was needed. `load` returns the linear repository; a Draft's first append creates
  the Chat Thread.
- **Expansion is stored as `collapsedDocumentIds`** in the layout store, so a new
  Document starts expanded; "Show more" state is `revealedDocumentIds` in the thread
  store and resets on restart.
- **Thread summaries arrive through `listChatThreads`**, one call at startup, rather
  than riding the Document library snapshot. Mutations return the updated summary
  and the renderer upserts it.
- **A streaming thread is remembered as its full target**, not by id, so a Draft
  whose first send is still in flight keeps its Document and identity when the User
  moves on. Each runtime owner freezes the target it was born with.
- **Tests scope message assertions to the thread region** (`reader.chatThread`)
  because the panel header now repeats the first message as the title.

## Deferred, deliberately

- Rename and model-generated titles.
- Removing a Document from the list (and whether that deletes its threads).
- Branching threads and editing user messages.
- Any migration mechanism; the schema is added with `IF NOT EXISTS` while there are
  no external installs.
