# PDFantom

A local-first macOS document reader where a User reads a PDF and discusses it with
language models of their choice. This glossary defines the language the codebase uses.
It is not a spec — implementation decisions live in `docs/adr/`.

## Language

### People, documents, and conversation

**User**:
The person reading Documents and chatting about them. PDFantom has exactly one, and
no account system.
_Avoid_: Student, customer, reader

**Document**:
A local PDF the User has opened in PDFantom, identified by its content rather than
its location on disk. A Document owns zero or more Chat Threads.
_Avoid_: Textbook, file, PDF (when naming the record rather than the format)

**Chat Thread**:
An ordered exchange of messages between the User and one or more Models, belonging
to exactly one Document. The User may switch Model partway through; the Chat Thread
stays the same. A Chat Thread owns zero or more Side Chats.
_Avoid_: Conversation, chat, thread (unqualified), session

**Side Chat**:
An exchange between the User and one or more Models that belongs to exactly one Chat
Thread, its parent, and exists to ask about that Chat Thread's content without adding
to it. A Side Chat is persisted with its parent and deleted with it, and is never
listed in the sidebar; it is reached only through its parent.
_Avoid_: Side thread, sub-thread, scratchpad, branch

**Draft**:
The empty composer shown for a Document before any message is sent. A Draft is not a
Chat Thread and is never persisted; it becomes a Chat Thread at first send. A Side
Chat Draft is the same thing for a Side Chat: an empty composer beside a Chat Thread
that becomes a Side Chat at first send.
_Avoid_: Empty thread, new thread, unsaved chat

**Assistant Message**:
One Model-generated reply within a Chat Thread, carrying its own Model and Model
Source provenance.
_Avoid_: Response, completion, answer

**Quote**:
Text the User selected and attached to the message they are composing, so the Model
knows which passage the question is about. A message carries zero or more Quotes;
each remembers its source, which is either a message in the Chat Thread or a page of
the Document. The spec's Context Attachments (page text and page images around a
Document selection, not yet built) would extend a Document-sourced Quote, not replace
it.
_Avoid_: Snippet, highlight, selection (when naming the attached thing rather than the
act of selecting), reply, document quote (as a separate concept: it is a Quote whose
source is the Document)

### Models and where they come from

**Model**:
A specific language model a User can select, identified by a catalog id such as
`openai/gpt-5.4-mini`.
_Avoid_: LLM, engine

**Model Source**:
Where a Model's catalog entry originates and which transport reaches it. Today
`openrouter` (HTTPS to the OpenRouter API) and `chatgpt` (a Codex Session on this
Mac). Every Model belongs to exactly one Model Source.
_Avoid_: Provider, backend, vendor

**Model Catalog**:
The curated set of Models offered to the User, merged from bundled entries and,
where a Model Source supports it, live listings.
_Avoid_: Model list, registry

### Borrowing Codex

**Codex Session**:
A Codex CLI installed on the User's Mac, new enough to speak the app-server
protocol, and reporting a working login. This — not a plan tier — is what unlocks
the `chatgpt` Model Source.
_Avoid_: ChatGPT subscription, ChatGPT account, OpenAI login

**Codex Thread**:
Codex's own in-memory record of one Chat Thread, created lazily and never persisted
to disk. It is a rebuildable cache, not a source of truth — PDFantom owns the Chat
Thread, and any divergence is repaired by starting a fresh Codex Thread.
_Avoid_: Session, conversation, context

**Codex Sign-In**:
Whatever authentication the Codex CLI already holds, established by the User
outside PDFantom via `codex login`. PDFantom reads it and never creates, stores,
refreshes, or transmits it.
_Avoid_: Credential, token, API key

**Provider Credential**:
A secret the User gives _to PDFantom_ to reach a Model Source directly, stored
encrypted on this Mac. The OpenRouter API key is one. A Codex Session is
deliberately not one — PDFantom never holds it.
_Avoid_: Secret, key, auth

## Flagged ambiguities

**Chat Thread vs. Codex Thread** — always qualify "thread".
A Chat Thread is PDFantom's durable record, owned by a Document and shown in the
sidebar. A Codex Thread is Codex's disposable in-memory projection of one Chat
Thread, and exists only while a Chat Thread is being served by the `chatgpt` Model
Source. A bare "thread" is not a term; say which one.

**Codex Session vs. Codex Thread** — different lifetimes, easily confused.
A Codex Session is an installed, authenticated Codex CLI: one per Mac, established
by the User outside PDFantom, and a precondition for the `chatgpt` Model Source
existing at all. A Codex Thread is one Chat Thread's worth of state inside a
running app-server process: many per Session, created and discarded by PDFantom.

**Model Source vs. "provider"** — resolved in favour of Model Source.
`src/shared/chat-api.ts` carries a single `ChatModelSourceId`
(`"openrouter" | "chatgpt"`); a `ChatRequest` and an Assistant Message's provenance
name their `source`. "Provider" is additionally overloaded by the product spec,
where it means the company behind a model (OpenAI, Anthropic, Google). Use
**Model Source** for the transport-and-catalog concept, and reserve "provider" for
the company when it appears in User-facing copy.

**"Student" and "Textbook"** — retired.
Earlier documents, the GitHub issues, and the accepted ADRs use Student for User and
Textbook for Document. New writing uses User and Document. ADRs are historical
records and keep their original wording.

**Closing a Side Chat vs. hiding the side panel** — closing deletes.
Closing a Side Chat removes it and its messages permanently; that is why a Side Chat
with messages asks for confirmation first. The side panel, by contrast, is shown or
hidden, and hiding it keeps every Side Chat of the Chat Thread. Never say "close" for
the panel or "hide" for a Side Chat.

**"Subscription"** — not a term in this domain.
PDFantom cannot observe a subscription; it observes a Codex Session. Entitlement is
enforced by OpenAI and surfaced to the User as an error from Codex, never predicted
by PDFantom.

## Example dialogue

> **Dev:** A User opens a textbook PDF and asks three unrelated questions on
> different days. Is that one Chat Thread?
>
> **Domain expert:** Only if they kept typing into the same one. Each time they
> start a new Chat Thread on that Document, it's a separate record with its own
> messages. The Document owns all of them.
>
> **Dev:** And if they switch from an OpenRouter model to a ChatGPT model halfway?
>
> **Domain expert:** Same Chat Thread. Each Assistant Message records which Model
> and Model Source produced it. On the Codex side, a Codex Thread gets created
> lazily for that Chat Thread — but that's a cache. If Codex restarts, we rebuild
> it from the Chat Thread we already hold.
>
> **Dev:** The User highlights a sentence in an Assistant Message and asks
> "what does this mean?" without wanting it in the main chat. Where does that go?
>
> **Domain expert:** Into a Side Chat. It belongs to that Chat Thread, sees the
> whole Chat Thread as context, and never adds a message to it. The Chat Thread can
> have several; they're tabs beside it, not rows in the sidebar. Delete the Chat
> Thread and its Side Chats go with it.
>
> **Dev:** And if they highlight a paragraph in the PDF itself and press "Add to
> chat"? Is that a different kind of attachment?
>
> **Domain expert:** No, it's a Quote too. The only difference is what it remembers
> as its source: a page range of the Document instead of a message. Same chip, same
> rule about not attaching the same passage twice.
>
> **Dev:** If a User is signed into Codex on the free plan, do they get the
> ChatGPT models in the picker?
>
> **Domain expert:** Yes. They have a Codex Session — Codex is installed and
> logged in. That's the whole gate. If OpenAI refuses the model, Codex returns
> the error and we show it on the Assistant Message. We don't guess at
> entitlement.
