# PDFantom

A secure, local-first macOS textbook reader.

## Development

Install project dependencies:

```sh
pnpm install
```

Run the unified formatter, linter, and type checker:

```sh
pnpm exec vp check
pnpm exec vp check --fix
```

Electron-specific workflows are available as package scripts:

```sh
pnpm start      # Start Electron Forge in development mode
pnpm build      # Build the main, preload, and renderer targets
pnpm test       # Build and run the Playwright Electron tests
pnpm test:e2e   # Run the tests against an existing build
pnpm package    # Package the macOS application
pnpm make       # Create the configured distributable
```

`pnpm exec vp test` runs Vite+'s built-in Vitest command; it does not run the Electron Playwright suite.
