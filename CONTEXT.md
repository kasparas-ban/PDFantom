# PDFantom

A local-first macOS document reader where a Student reads a PDF and discusses it
with a language model of their choice. This glossary defines the language the
codebase uses. It is not a spec — implementation decisions live in `docs/adr/`.

## Language

### People and conversation

**Student**:
The person reading a document and chatting about it. PDFantom has exactly one, and
no account system.
_Avoid_: User, customer

**Conversation**:
An ordered exchange of messages between a Student and one Model, scoped to a
reading session.
_Avoid_: Chat, thread, session

**Assistant Message**:
One Model-generated reply within a Conversation, carrying its own Model and Model
Source provenance.
_Avoid_: Response, completion, answer

### Models and where they come from

**Model**:
A specific language model a Student can select, identified by a catalog id such as
`openai/gpt-5.4-mini`.
_Avoid_: LLM, engine

**Model Source**:
Where a Model's catalog entry originates and which transport reaches it. Today
`openrouter` (HTTPS to the OpenRouter API) and `chatgpt` (a Codex Session on this
Mac). Every Model belongs to exactly one Model Source.
_Avoid_: Provider, backend, vendor

**Model Catalog**:
The curated set of Models offered to the Student, merged from bundled entries and,
where a Model Source supports it, live listings.
_Avoid_: Model list, registry

### Borrowing Codex

**Codex Session**:
A Codex CLI installed on the Student's Mac, new enough to speak the app-server
protocol, and reporting a working login. This — not a plan tier — is what unlocks
the `chatgpt` Model Source.
_Avoid_: ChatGPT subscription, ChatGPT account, OpenAI login

**Codex Thread**:
Codex's own in-memory record of one Conversation, created lazily and never persisted
to disk. It is a rebuildable cache, not a source of truth — PDFantom owns the
Conversation, and any divergence is repaired by starting a fresh Codex Thread.
_Avoid_: Session, conversation, context

**Codex Sign-In**:
Whatever authentication the Codex CLI already holds, established by the Student
outside PDFantom via `codex login`. PDFantom reads it and never creates, stores,
refreshes, or transmits it.
_Avoid_: Credential, token, API key

**Provider Credential**:
A secret the Student gives _to PDFantom_ to reach a Model Source directly, stored
encrypted on this Mac. The OpenRouter API key is one. A Codex Session is
deliberately not one — PDFantom never holds it.
_Avoid_: Secret, key, auth

## Flagged ambiguities

**Codex Session vs. Codex Thread** — different lifetimes, easily confused.
A Codex Session is an installed, authenticated Codex CLI: one per Mac, established
by the Student outside PDFantom, and a precondition for the `chatgpt` Model Source
existing at all. A Codex Thread is one Conversation's worth of state inside a
running app-server process: many per Session, created and discarded by PDFantom.

**Model Source vs. "provider"** — resolved in favour of Model Source.
`src/shared/chat-api.ts` carries a single `ChatModelSourceId`
(`"openrouter" | "chatgpt"`); a `ChatRequest` and an Assistant Message's provenance
name their `source`. "Provider" is additionally overloaded by the product spec,
where it means the company behind a model (OpenAI, Anthropic, Google). Use
**Model Source** for the transport-and-catalog concept, and reserve "provider" for
the company when it appears in Student-facing copy.

**"Subscription"** — not a term in this domain.
PDFantom cannot observe a subscription; it observes a Codex Session. Entitlement is
enforced by OpenAI and surfaced to the Student as an error from Codex, never
predicted by PDFantom.

## Example dialogue

> **Dev:** If a Student is signed into Codex on the free plan, do they get the
> ChatGPT models in the picker?
>
> **Domain expert:** Yes. They have a Codex Session — Codex is installed and
> logged in. That's the whole gate.
>
> **Dev:** But free plan won't actually run GPT-6-Astra.
>
> **Domain expert:** Right, and OpenAI will say so. Codex returns the error, we
> show it on the Assistant Message. We don't guess at entitlement, because the
> moment we hardcode which plans work we're wrong the next time OpenAI adds a tier.
>
> **Dev:** And if they signed in with an API key instead?
>
> **Domain expert:** Still a Codex Session. Note it's not a Provider Credential
> though — we never see that key, it lives in Codex's own config. Contrast the
> OpenRouter key, which the Student hands us and we encrypt on disk.
>
> **Dev:** So both are "chatgpt" Model Source.
>
> **Domain expert:** Both are the `chatgpt` Model Source, yes. How they
> authenticated is Codex's business, not ours.
