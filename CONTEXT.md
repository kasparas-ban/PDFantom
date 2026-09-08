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
stays the same.
_Avoid_: Conversation, chat, thread (unqualified), session

**Draft**:
The empty composer shown for a Document before any message is sent. A Draft is not a
Chat Thread and is never persisted; it becomes a Chat Thread at first send.
_Avoid_: Empty thread, new thread, unsaved chat

**Assistant Message**:
One Model-generated reply within a Chat Thread, carrying its own Model and Model
Source provenance.
_Avoid_: Response, completion, answer

**Quote**:
Text the User selected from a message in a Chat Thread and attached to the message
they are composing, so the Model knows which passage the question is about. A message
carries zero or more Quotes; each remembers the message it came from. Quotes and the
spec's Context Attachments (text and pages selected from the Document, not yet built)
are both attachments on a user message.
_Avoid_: Snippet, highlight, selection (when naming the attached thing rather than the
act of selecting), reply

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
> **Dev:** If a User is signed into Codex on the free plan, do they get the
> ChatGPT models in the picker?
>
> **Domain expert:** Yes. They have a Codex Session — Codex is installed and
> logged in. That's the whole gate. If OpenAI refuses the model, Codex returns
> the error and we show it on the Assistant Message. We don't guess at
> entitlement.
