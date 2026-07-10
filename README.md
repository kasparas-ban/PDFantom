# PDFantom

A secure, local-first macOS textbook reader.

## Development

Install the [Vite+ CLI](https://viteplus.dev/guide/) and project dependencies:

```sh
vp install
```

Run the unified formatter, linter, and type checker:

```sh
vp check
vp check --fix
```

Electron-specific workflows remain package scripts and must be run through `vp run`:

```sh
vp run start      # Start Electron Forge in development mode
vp run build      # Build the main, preload, and renderer targets
vp run test       # Build and run the Playwright Electron tests
vp run test:e2e   # Run the tests against an existing build
vp run package    # Package the macOS application
vp run make       # Create the configured distributable
```

`vp test` runs Vite+'s built-in Vitest command; it does not run the Electron Playwright suite.
