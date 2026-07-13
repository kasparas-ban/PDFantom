# PDFantom

A secure, local-first macOS document reader.

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
pnpm test       # Build and run the Playwright Electron tests in the background
pnpm test:e2e   # Run the background tests against an existing build
pnpm test:e2e:visible # Show the app while running tests for debugging
pnpm test:e2e:native-window # Run tests that exercise the macOS window manager
pnpm package    # Package the macOS application
pnpm make       # Create the configured distributable
```

The Playwright suite launches Electron with a hidden, rendering window by default, so
PDFantom does not appear or take focus during a test run. Use `pnpm test:e2e:visible`
when you need to watch the app. Playwright's `--headed` option does not control windows
launched through its Electron API.

Tests tagged `@native-window` are excluded from background runs because macOS makes the
window visible for native transitions such as entering full screen. The visible suite
runs them, or they can be run alone with `pnpm test:e2e:native-window`.

`pnpm exec vp test` runs Vite+'s built-in Vitest command; it does not run the Electron Playwright suite.
