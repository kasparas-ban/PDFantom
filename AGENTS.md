## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The repository uses the canonical five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

The repository uses a single-context domain-document layout. See `docs/agents/domain.md`.

### Renderer UI

Use shadcn/ui components and Tailwind CSS utilities for all renderer UI, reserving custom CSS for global theming and unavoidable third-party integrations.

### TypeScript return types

Do not add explicit function return type annotations when TypeScript can infer the intended type. Add one only when the inferred return type would differ from the intended return type and the annotation is necessary to express that contract.

### Testing

Keep test-only code out of business logic by using explicit test seams at application boundaries.
