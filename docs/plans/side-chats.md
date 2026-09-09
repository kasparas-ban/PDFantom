# Side Chats

A Chat Thread owns zero or more Side Chats: exchanges the User opens beside the main
chat panel to ask about the Chat Thread's content without adding to it. Modelled on
the Codex desktop app's side chat panel. Vocabulary follows `CONTEXT.md`: User,
Document, Chat Thread, Side Chat, Draft, Quote, Assistant Message.

## Decisions so far

- **Ownership and persistence.** A Side Chat belongs to exactly one parent Chat
  Thread, is persisted in SQLite alongside it, is deleted when the parent is deleted,
  and never appears in the sidebar. It is reached only through its parent. This
  deliberately differs from Codex, whose side chats are temporary.
- **Many per parent.** A Chat Thread may have several Side Chats, shown as tabs in
  the side panel's header. A plus button creates another.
- **Closing a Side Chat deletes it completely.** The × on a tab removes the Side Chat
  and its messages from SQLite; there is no hidden-but-kept state. Hiding the side
  panel with the header toggle is a different action and keeps every Side Chat. A Side
  Chat with nothing sent yet (a Side Chat Draft) is discarded silently. One with messages shows a confirmation dialog:
  "Close side chat? This side chat will be gone and can't be recovered. Are you
  sure?" with Cancel, a destructive "Close side chat", and a "Don't ask again"
  checkbox. Ticking it is a persisted preference that skips the dialog thereafter.
- **Side Chat Draft.** Mirrors Draft: renderer-only until first send, when the row is
  written together with the first user message.
- **Live parent transcript.** Every Side Chat send carries the parent Chat Thread's
  full transcript as it stands at that moment, framed by a short instruction that
  this is a side conversation about the main one and must not continue it, followed
  by the Side Chat's own history. The Quote the Side Chat was opened from is an
  ordinary Quote on its first user message. Through the `chatgpt` Model Source the
  Side Chat's Codex Thread receives the parent's new messages as part of the turn
  input rather than being rebuilt.
- **"Ask in side chat" targets the active Side Chat.** Pressing it opens the side
  panel if closed, adds the selection as a Quote to the active Side Chat's composer
  (guarding duplicates as "Add to chat" does), and focuses that composer. If the Chat
  Thread has no Side Chat yet, a Side Chat Draft is created holding the Quote. The
  plus button is the only way to start another Side Chat; it creates an empty Side
  Chat Draft and makes it the active tab. The main chat panel header gets a toggle
  that opens or closes the side panel without a selection; opening it with no Side
  Chats shows a Side Chat Draft.
- **Switching parents.** Whether the side panel is open is a global layout
  preference, persisted with the other panel state. An open panel always shows the
  active Chat Thread's Side Chats; the active tab per parent is the most recently
  viewed one. A parent with no Side Chats shows a Side Chat Draft. A streaming Side
  Chat keeps streaming across switches like a background Chat Thread. The header
  toggle is disabled while the parent is a Draft or no Document is active.
- **Model selection.** A new Side Chat starts with its parent's current Model and
  effort, then remembers its own selection like a Chat Thread. Changing it never
  touches the parent, and does not update the global last-selected Model that seeds
  new Drafts.
- **Layout.** The side panel is a third resizable panel right of the chat panel with
  its own persisted width, starting at the chat panel's default. The layout budget
  generalises from two panels to three: they share the width left after the reader's
  minimum, the most recently resized panel keeps its width, and the others give way.
  The side panel header carries only the tab strip and the plus button; expand and
  minimise controls from Codex are left out. The main chat header's toggle shows or
  hides the panel and never deletes anything.
- **Tab titles.** Derived from the first user message with the Chat Thread rule,
  falling back to the Quote text; truncated to a fixed tab width with the full title
  as a tooltip. A Side Chat Draft's tab reads "Side chat".
- **Selection inside a Side Chat.** "Add to chat" quotes into the Side Chat's own
  composer. "Ask in side chat" is not shown there: Side Chats do not nest. No
  "Add to main chat" action yet.

## Starting point

- The "Ask in side chat" button exists in `chat-selection-toolbar.tsx`, disabled with
  a "Coming soon" tooltip; `tests/app/chat-quotes.spec.ts` asserts that state.
- `chat_threads` rows belong to a Document; `listChatThreads` returns every row and
  the sidebar groups them by `documentId`. Schema changes are `CREATE TABLE IF NOT
  EXISTS` plus an ad-hoc `ALTER TABLE ... ADD COLUMN` guarded by `pragma_table_info`,
  as done for `quotes_json`. No migration mechanism, by decision.
- `ChatSessionProvider` owns one assistant-ui runtime per visible or streaming
  `ChatThreadTarget`; `ChatPanel` renders the active one. The main process allows one
  in-flight request per conversation id and keys Codex Threads by it.
- `resolveReaderWorkspaceLayout` budgets exactly two panels; `ReaderPage` mounts them
  around the reader and persists widths in the layout store.

## Schema

`chat_threads` gains one nullable column, added with the existing guarded `ALTER`:

```sql
parent_thread_id TEXT REFERENCES chat_threads(id) ON DELETE CASCADE
CREATE INDEX IF NOT EXISTS chat_threads_by_parent ON chat_threads (parent_thread_id);
```

A Side Chat is a `chat_threads` row whose `parent_thread_id` is set; its
`document_id` copies the parent's so Document cascade and queries stay unchanged.
Messages live in `chat_messages` as today. Deleting the parent cascades. No separate
table: a Side Chat has the same shape as a Chat Thread, only its owner differs.

## IPC surface

- `ChatThreadSummary` gains `parentThreadId: string | null`. `listChatThreads` keeps
  returning every row; the renderer partitions on `parentThreadId`.
- `createChatThread` accepts an optional `parentThreadId`; the repository copies the
  parent's `document_id` and rejects a parent that is itself a Side Chat.
- `ChatRequest` gains an optional `parentThreadId`. When present the main process
  assembles the parent context itself from SQLite (see below). The renderer never
  ships the parent transcript.
- `deleteChatThread` on a parent first aborts and forgets every child's in-flight
  request and Codex Thread, then deletes; cascade removes the rows.

## Parent context assembly (main process)

The renderer's Side Chat adapter sends only the Side Chat's own messages plus
`parentThreadId`. The main process loads the parent's persisted messages and renders
them, oldest first, with the same role labels as `flattenTranscript`, user turns
formatted with their Quotes via `formatUserMessageContent` (moved to `src/shared`).
The block is prefixed by a fixed instruction: the following is the main conversation,
the User is asking about it in a side conversation, answer the side conversation and
do not continue the main one.

- **OpenRouter**: prepend that block as a `system` message on every request.
- **Codex**: `CodexThreadState` additionally records `parentMessageCount`. A Side
  Chat's first turn on a fresh Codex Thread carries the full block. Later turns
  compare the parent's current message count with the recorded one and, when it has
  grown, prefix the turn input with "The main conversation has continued:" and the new
  parent messages only. The rebuild path carries the full block again.

Consequence: a parent Assistant Message still streaming is not yet persisted (ADR
0004) and so is absent from a Side Chat sent during that stream. Accepted; the next
Side Chat turn sees it.

## Renderer

- `ChatThreadTarget` gains `parentThreadId: string | null`. `chat-thread-store` gains
  `activeSideChat: ChatThreadTarget | null` (per parent, resolved from
  `lastViewedAt` when the parent becomes active, or a fresh Side Chat Draft),
  `openSideChat`, `startSideChatDraft(parentId)`, `removeSideChat`. `threadsOfDocument`
  excludes rows with a parent; `sideChatsOf(parentId)` orders by `createdAt` for a
  stable tab order.
- `ChatSessionProvider` owns runtimes for the active Chat Thread, the active Side
  Chat, and anything streaming, using the same keyed `ChatSessionOwner`. The Side Chat
  owner builds its adapter with `conversationId = sideChatId` and passes
  `parentThreadId` on every request. Its history adapter creates the row with
  `parentThreadId` at first send. Its initial selection is the parent's current
  selection; the Side Chat's own selection changes are remembered on its row and do
  not touch the global model store's last-selected value.
- `ChatPanel` splits into the shared presentation (thread, composer, toolbar) and two
  headers: the main header gains a "Toggle side chats" button; the side header is the
  tab strip plus a plus button. `ChatSelectionToolbar` takes a `mode` so the Side Chat
  hides "Ask in side chat".
- "Ask in side chat" in the main panel: open the side panel, ensure an active Side
  Chat (or Side Chat Draft), add the Quote to its composer through its client with
  the existing duplicate guard, focus its textarea.
- Layout store: `isSideChatPanelOpen`, `preferredSideChatPanelWidth`, and
  `lastResizedPanel` widens to `"chat" | "documents" | "side-chat"`, plus
  `skipSideChatCloseConfirmation` for "Don't ask again". `resolveReaderWorkspaceLayout`
  generalises to a list of open panels sharing `panelBudget`, the last resized keeping
  its preferred width and the rest scaling as today. `ReaderPage` mounts a
  `ResizableSideChatPanel` (side `"right"`, own handle label) after the chat panel.
- Closing a tab: a Side Chat Draft is dropped from the store; a Side Chat with messages
  opens the confirmation dialog unless skipped, then `deleteChatThread` and
  `removeSideChat`. The next tab to the right becomes active, else the left, else a
  fresh Side Chat Draft.
- Empty state for a Side Chat Draft: "Side chat" and one line saying it asks about the
  main chat without adding to it. No "temporary" copy.

## Tests

- Unit: layout with three panels; thread store partitioning and active Side Chat
  resolution; model adapter passing `parentThreadId`; Codex turn planning with a
  grown parent; parent block formatting.
- Repository (`tests/app/chat-thread-repository.spec.ts`): create with parent copies
  document, rejects nested parent, cascade on parent delete, list carries
  `parentThreadId`.
- Playwright: update `chat-quotes.spec.ts` for the enabled button; new
  `side-chats.spec.ts` covering open from selection with Quote, second tab via plus,
  request body containing the parent transcript as a system message, tab titles,
  close with and without dialog, "Don't ask again", survival across restart, panel
  following the active Chat Thread, resize handle. Driver gains `sideChatPanel`
  locators mirroring the chat ones.

## Slices

1. **Persistence and context.** Column, repository, IPC, `parentThreadId` on
   `ChatRequest`, main-process parent block for OpenRouter and Codex, unit and
   repository tests. No UI yet; verifiable through the boundary tests.
2. **Panel.** Layout for three panels, side panel with one Side Chat, header toggle,
   "Ask in side chat" enabled and quoting into it, Side Chat Draft and empty state,
   parent switching, streaming across switches.
3. **Tabs.** Tab strip, plus button, derived titles, close with confirmation and
   "Don't ask again", active-tab memory per parent, parent delete cascading and
   aborting children.

## Deferred, deliberately

- "Add to main chat" (promoting a Side Chat answer into the parent).
- Expand and minimise controls on the side panel; a keyboard shortcut for the toggle.
- A settings entry to reset "Don't ask again".
- Nested Side Chats. Rejected rather than deferred: a Side Chat's parent is always a
  Chat Thread.
