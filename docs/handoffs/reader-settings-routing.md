**PDFantom: reader and Settings routing implementation handoff**

Prepared on September 3, 2026. Repository: `/Users/kasparas/Documents/PDFantom`.

**Objective.** Fix the brief overlap of reader controls and Settings when navigating through “Choose provider” or the Settings button. Establish reliable page isolation while preserving the PDF and chat sessions. Use React Router for navigation and React Activity for retained UI. The user plans to port the app to the web. Backwards compatibility is not required.

**Status.** Investigation and temporary Electron experiments are complete. The application refactor has not been implemented, and React Router is not installed. The implementation steps and acceptance criteria below define the remaining work. Recheck the working tree before starting.

**Architecture.** React Router owns route matching, navigation, history, redirects, and the URL. React owns visibility and effect lifetime through `<Activity>`. PDF.js-specific suspension and resumption use ordinary effect setup and cleanup. Keep resource owners outside the Activity that hides their presentation. Replace the current navigation APIs directly.

**Confirmed cause and evidence.**

- The current `App` mounts Settings beside a retained reader `<main>`. The reader receives `invisible absolute inset-0`, `inert`, and `aria-hidden`.
- Shared buttons use `transition-all`. Changing their inherited visibility starts a 150 ms CSS visibility transition. Settings is already visible while those buttons remain painted.
- Frame sampling in Electron reproduced approximately ten overlapping frames, including “Choose provider,” document controls, panel buttons, and chat controls. The Settings destination and open flag already update together; the observed defect is presentation isolation.
- A temporary `display: none` override on the outgoing workspace produced zero overlapping frames. Returning preserved a chat draft, page 2 of a fixture PDF, and the same actual canvas node.
- A separate experiment opened the model menu and triggered navigation programmatically. The menu remained visible over Settings for the entire approximately 200 ms observation, even with the workspace set to `display: none`. Its portal lived outside the workspace.
- Existing Settings tests check eventual visibility and use accessibility locators. They do not catch the first-frame overlap or painted descendants of an `aria-hidden` ancestor.

The temporary CSS experiment established the visual fix; it did not validate React Router or Activity integration, precise selection restoration, every loading race, or hidden-page resizing. Those require the implementation tests below. The CSS behavior is consistent with the [CSS Transitions specification](https://www.w3.org/TR/css-transitions-1/).

**Framework behavior to rely on.** React Activity retains its children's state and DOM, hides them with `display: none`, cleans up their effects while hidden, and restarts effects when shown. It does not define how an external PDF renderer should pause. Connect that resource through normal cleanup. React's own example uses a layout-effect cleanup to pause retained media when hidden. [React Activity reference](https://react.dev/reference/react/Activity)

The repository currently uses React and React DOM 19.2.7, so Activity is already available. Verify dependency compatibility when adding the current stable React Router release. Use Data Mode with the existing Vite build and a shared route-object configuration. [React Router modes](https://reactrouter.com/start/modes)

1. **Introduce React Router and the route tree.**

   Keep route definitions independent of platform bootstrap. Use `createHashRouter` in Electron, `createBrowserRouter` for the future web entry point, and `createMemoryRouter` in routing tests. Mount with `RouterProvider`. Hash routing fits the packaged renderer's current `file://.../index.html` entry; the hash changes without changing the document path. [Hash router reference](https://reactrouter.com/api/data-routers/createHashRouter)

   Define these destinations:

   | Route                  | Presentation                                                   |
   | ---------------------- | -------------------------------------------------------------- |
   | `/`                    | Retained reader surface                                        |
   | `/settings`            | Settings layout; index redirects to `general` with replacement |
   | `/settings/general`    | General settings                                               |
   | `/settings/appearance` | Appearance settings                                            |
   | `/settings/provider`   | AI Provider settings                                           |
   | `/settings/about`      | About settings                                                 |
   | `*`                    | Not-found page with a link to the reader                       |

   Use an enduring root `AppShell` route. Settings is a nested layout with an `<Outlet />` and explicit child routes. Give the reader index route a stable ID so the shell can derive Activity mode from `useMatches()`. The index route may render no element: the actual retained reader lives in the shared shell, not in the changing child outlet. Keep matching logic in React Router. [Data routing reference](https://reactrouter.com/start/data/routing)

   Convert navigation destinations to `Link` and Settings sections to `NavLink`, composed with the existing shadcn/Base UI components without nesting interactive elements. Reserve `useNavigate` for programmatic navigation. Both “Choose provider” buttons link to `/settings/provider`. The Settings button links to `/settings/general`. “Back to app” links explicitly to `/`, so direct entry into Settings also works. Back and Forward use normal router history. [Navigation reference](https://reactrouter.com/start/data/navigating)

   Delete `isSettingsOpen`, `settingsPage`, `openSettings`, and `closeSettings` from the app configuration store and all callers. React Router is the sole source of navigation state. If a Settings-section type is still needed, name it `SettingsSection`; route selection comes from the router.

2. **Restructure composition around persistent sessions and Activity.**

   Make `main.tsx` a small bootstrap. Extract the app shell and reader presentation from the current large `App`. Keep appearance/preferences available at app scope. A schematic composition is:

   ```text
   RouterProvider
     AppShell (shared root route)
       Persistent workspace/session owners
         Activity (mode derived from matched reader route)
           ReaderPage
             Reader lifecycle effect
             Reader controls and panels
             Stable PDF host
             Page-local portal container
         Outlet
           SettingsLayout -> active Settings child
           or NotFound
   ```

   The Activity remains at a stable tree position and is not keyed by pathname. Keep the reader's DOM attached there across route changes. A store above an outlet alone cannot preserve a canvas if its route element unmounts. Settings sections mount normally and discard their local form state when left, including revealed API-key text and unsaved key drafts.

   Let Activity control visibility and remove the reader's existing `invisible absolute inset-0` switching mechanism. Every reader visual, including floating toolbar buttons, belongs under the retained reader surface. Expose one accessible active main landmark. A semantic wrapper can contain the portal root and page focus target.

   Preserve lazy chat loading on first use. Once initialized, the chat resource owner remains mounted outside the hidden Activity and outside conditional panel presentation. The current `useChatRuntime` inside `ChatPanel` must be moved; simply wrapping the current `App` in Activity would clean up resource-creation effects and destroy the sessions we intend to preserve.

3. **Connect PDF activity using ordinary React effects.**

   Keep the existing `ReaderWorkspace` as the resource owner for PDF workers, retained readers, and previews. Its lifetime follows the persistent session, not route visibility. Dispose it on genuine owner teardown, including safe React StrictMode setup/cleanup cycles.

   Place a small integration component/hook inside the reader Activity. Once a stable, initialized workspace is available, the lifecycle contract is:

   ```tsx
   useLayoutEffect(() => {
     workspace.suspend(false)

     return () => workspace.suspend(true)
   }, [workspace])
   ```

   This is illustrative integration code, not a complete initialization implementation. The owner must exist when setup runs, and cleanup must capture that owner. Do not rely on an optional mutable ref that silently skips setup when initialization occurs later. Activity may detach and reattach refs: ref detachment must not be treated as final session disposal.

   Use this setup/cleanup to retain geometry, flush position, preserve selection, and pause/restart PDF presentation. Validate the actual Activity/PDF.js ordering in Electron. Preserve last valid dimensions instead of overwriting them with a zero-size hidden host. Make repeated suspension/resumption harmless. On return, reconcile fit scale, dimensions, and preview compatibility with the measurable host before presenting the live reader.

   Direct initial entry to Settings must not require a measurable reader. Defer layout-dependent initialization until the reader is first activated. Ensure lazy initialization, hidden-to-visible activation, final disposal, and StrictMode cycles do not create duplicate active owners or leave destroyed owners in use.

   Links, history navigation, redirects, and direct entry all flow through router rendering and Activity. Ordinary effect setup and cleanup handle PDF activity for all these entry points.

4. **Harden the existing reader against asynchronous completion while inactive.**

   Activity cleans up React effects; it cannot cancel promises or callbacks owned by the persistent `ReaderWorkspace`. Audit its retained-reader preparation, new-surface creation, readiness callbacks, preview decoding/publication, capture, and layout observers together.

   Current code has concrete paths to address: `prepare()` can call `reveal(retained)` and can call `surface.prepare()` after an awaited document load; `tryPreview()` can publish a late preview. Checking suspension only in the readiness callback does not cover every path.

   File loading and verification may complete in the background. Newly created readers must start inactive when suspended; they must not prepare against hidden geometry. Centralize presentation eligibility in the existing reader owner and enforce it for both live readers and previews. Preserve existing generation/fingerprint checks so stale results cannot replace the current target.

   Dispose a decoded preview that cannot be presented; on activation, retry the current target's preview only if still useful. Resume the current document even if its load completed while hidden. Defer layout-dependent responses to window size or appearance changes until the reader is measurable. Capture previews only from visible, compatible readers.

5. **Separate session state from presentation effects.**

   | State or resource                             | Lifetime and behavior                                      |
   | --------------------------------------------- | ---------------------------------------------------------- |
   | URL and Settings section                      | React Router                                               |
   | Appearance and panel preferences              | App configuration                                          |
   | PDF worker, retained surfaces, document state | Persistent workspace; suspend presentation in Settings     |
   | Chat runtime, messages, draft, selected model | Persistent chat session; an existing response can continue |
   | Reader shortcuts and layout observers         | Ordinary effects inside reader Activity                    |
   | Menus, filter text, pointer capture           | Transient UI; close/reset/release on departure             |
   | Settings forms and revealed key               | Current Settings route component                           |

   Move global arrow-key navigation into one reader presentation hook, preserving editable-field, modifier-key, and handled-event exclusions. Effect cleanup removes the listener when Activity hides the reader. Remove checks for `isSettingsOpen` from individual controls.

   Reuse existing resize cleanup to release pointer capture, cancel the gesture, clear its start state, and restore body cursor/user-selection styles on effect cleanup. Use layout-effect cleanup where this must finish before paint. The cleanup must cover Activity hiding as well as actual unmounting.

   Refresh provider configuration status through a presentation effect that runs on reader activation, with stale-request protection. Share the status between the empty-chat prompt and chat error presentation. Replace the current Settings-flag-driven refresh. Keep model context registration with the persistent chat session if needed by a response that continues while the reader is hidden.

6. **Contain popups and restore focus correctly.**

   Give each page a portal container inside its own visual boundary, outside scrolling panels. Route shared dropdown content to that container using Base UI's supported portal destination. Do not transiently fall back to the document body while the container is unavailable.

   Activity preserves component state, so hiding alone does not define the desired closed state of a menu. Use normal component effects and the menu's controlled APIs to reset open state and filter text when leaving/re-entering. Verify behavior under Activity; do not assume effects that close a popup also prevent focus restoration into a hidden trigger. Page-local containment guarantees paint isolation independently of an exit animation.

   Focus the active Settings heading/page root on entry and section navigation. Return to an appropriate reader control on reactivation if still available, otherwise the reader root. Use `preventScroll` where useful. Suppress a popup's automatic trigger focus restoration during page departure. Keep focus/selection work compatible with PDF selection restoration. [React Router accessibility guidance](https://reactrouter.com/how-to/accessibility)

7. **Prepare the composition boundary for a web build.**

   Reuse the existing document/settings/window contracts. Supply their Electron preload-backed implementation at bootstrap/provider boundaries, and remove direct `window.pdfantom` access from route presentation as those components are refactored. The future web entry supplies browser-appropriate implementations and the browser router. Do not build a generic platform framework or the full web port as part of this change.

   The current Electron trust check validates the sender, main frame, origin, and pathname; URL fragments do not affect its document comparison. Hash routes therefore fit that boundary. Add regression coverage that document/settings/window calls still work after navigation without loosening trust checks. A future BrowserRouter deployment needs an SPA server fallback for nested-URL reloads. [Web SPA deployment guidance](https://reactrouter.com/how-to/spa)

8. **Narrow animations and validate the complete behavior.**

   Replace `transition-all` in shared buttons, the model selector, and appearance controls with the properties actually animated: relevant colors, borders, shadows, opacity, and transforms/individual transform properties as needed. Exclude visibility, display, and layout geometry. Preserve useful interaction feedback. Do not add page exit animations to solve this bug.

   Add focused tests at existing boundaries. Use this acceptance matrix:

   | Scenario                                           | Required result                                                                                          |
   | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
   | Both provider links and the Settings button        | Correct URL/section; zero outgoing content once destination is painted                                   |
   | Explicitly visible or animated descendant          | Cannot paint through the hidden reader boundary                                                          |
   | Open model popup during navigation                 | No visible popup on destination; no hidden trigger receives focus; menu closed on return                 |
   | Reader -> Settings -> reader                       | Same retained canvas on unchanged geometry; precise page, zoom, scroll position, and selection preserved |
   | Chat -> Settings -> chat                           | Draft, messages, and model preserved; a mocked in-flight response behaves as intended                    |
   | Keyboard/Tab use in Settings                       | No reader navigation or focus in hidden content                                                          |
   | Navigate during panel resize                       | Pointer capture and body interaction styles restored                                                     |
   | PDF load/preview resolves while hidden             | No hidden presentation or zero-size preparation; correct current target resumes                          |
   | Resize or change appearance while in Settings      | Reader reconciles correctly on return; incompatible previews are not shown                               |
   | Initial Settings URL and reload there              | Correct section; reader safely inactive until visited                                                    |
   | Back/Forward, Settings index redirect, unknown URL | Standard history behavior and correct active surface                                                     |
   | Repeated navigation and StrictMode cleanup         | No unintended duplicate listeners, workers, or disposal of retained sessions                             |
   | Electron hash navigation                           | Allowlisted IPC still works; trust enforcement remains effective                                         |

   Install visual frame sampling before the navigation action and inspect the first committed destination frame through at least the former 150 ms transition window. Keep animations enabled. Inspect actual element visibility and portal content across the document; role locators alone are insufficient. Assert no frame contains both active Settings and painted reader controls. Do not let retry-until-hidden assertions substitute for this check.

   Use existing explicit document/worker/renderer test seams to delay loads and previews. Stub chat at its boundary rather than sending external requests. Keep test-only code outside business logic. Broaden tests only for the concrete lifecycle and integration risks in this matrix.

**Code map.** Paths are relative to the repository root so this handoff remains usable in another checkout. Suggested component names above express responsibilities, not a requirement to create one file or abstraction per name.

| Area                                     | Files to inspect/change                                                                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer composition and current overlay | `src/renderer/src/main.tsx`                                                                                                                                                                                                       |
| Current navigation state                 | `src/renderer/src/store/app-config-store.ts`, `src/renderer/src/store/app-config-provider.tsx`                                                                                                                                    |
| Reader session data                      | `src/renderer/src/store/reader-session-store.ts`, `src/renderer/src/store/reader-session-provider.tsx`                                                                                                                            |
| Reader ownership, surfaces and runtime   | `src/renderer/src/reader-workspace.ts`, `src/renderer/src/document-reader.tsx`, `src/renderer/src/pdf-reader-runtime.ts`, `src/renderer/src/reader-preview.ts`                                                                    |
| Settings routes/layout                   | `src/renderer/src/settings/settings-view.tsx`, `src/renderer/src/settings/settings-layout.tsx`, and section components                                                                                                            |
| Navigation callers and shortcuts         | `src/renderer/src/chat-panel-control.tsx`, `src/renderer/src/sidebar/chat-panel.tsx`, `src/renderer/src/page-controls.tsx`                                                                                                        |
| Chat lifetime and resizing               | `src/renderer/src/sidebar/chat-panel.tsx`, `src/renderer/src/sidebar/resizable-chat-panel.tsx`, `src/renderer/src/sidebar/resizable-panel.tsx`                                                                                    |
| Popups, model state and animations       | `src/renderer/src/components/chat-model-selector.tsx`, `src/renderer/src/components/ui/dropdown-menu.tsx`, `src/renderer/src/components/ui/button.tsx`, `src/renderer/src/settings/appearance-settings.tsx`                       |
| Platform contracts and bootstrap         | `src/shared/document-api.ts`, `src/shared/settings-api.ts`, `src/shared/window-api.ts`; `src/main/renderer-entry.ts`, `src/main/trusted-renderer.ts`                                                                              |
| Existing integration tests               | `tests/app/document-reader.spec.ts`, `tests/app/document-handoff.spec.ts`, `tests/app/reading-position.spec.ts`, `tests/app/reader-workspace.spec.ts`, `tests/app/reader-boundary.spec.ts`, `tests/app/renderer-security.spec.ts` |
| Test infrastructure                      | `tests/app/drivers/document-reader-driver.ts`, `tests/app/launch-application.ts`, `tests/renderer/reader-boundary.ts`                                                                                                             |

**Repository requirements.** Read `AGENTS.md` and its linked instructions. Use shadcn/ui and Tailwind for renderer UI; keep custom CSS limited to global theming and necessary third-party integration. Let TypeScript infer return types unless a different explicit contract is necessary. Separate logical blocks with blank lines. Reuse existing resource owners and test seams. Keep abstractions proportional to the concrete behavior. Issues and PRDs are tracked in GitHub Issues; this file is an implementation handoff, not a published ticket.

**Suggested delivery order.** Work in reviewable slices: (1) route configuration and bootstrap, (2) persistent shell/session ownership and Activity integration, (3) suspended asynchronous work plus popup/focus/interaction cleanup, and (4) narrowed animations and integrated regression coverage. Add relevant tests with each slice. Convert the router, shell, and all navigation callers in one coordinated cutover.

**Validation commands.** The documented workflow is:

```sh
pnpm exec vp check
pnpm build
pnpm exec playwright test tests/app/document-reader.spec.ts tests/app/document-handoff.spec.ts tests/app/reading-position.spec.ts tests/app/reader-workspace.spec.ts tests/app/reader-boundary.spec.ts tests/app/renderer-security.spec.ts
pnpm test:e2e
```

Run targeted tests during implementation and the full existing Playwright suite once against the final build. Include any new routing test files. The suite normally launches a hidden Electron window; use the documented visible/native-window commands only when those checks require it.

During investigation, the configured pnpm 11.9.0 launcher was missing from its managed location. Existing dependencies were present, and builds succeeded with `node_modules/.bin/vp`. Recheck package-manager availability before adding React Router. Report final integration test results separately from the diagnostic experiments.

**Completion report.** Report the final ownership structure, routes/router choice, removed legacy state, lifecycle and portal fixes, tests actually run, and any remaining limitation. The finished behavior must preserve normal reader/chat state while making the destination the only visible and interactive page from its first painted frame.
