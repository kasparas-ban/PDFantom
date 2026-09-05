import path from "node:path"
import { pathToFileURL } from "node:url"

import { build } from "vite"

import { expect, test } from "./test"

type Boundary = typeof import("../renderer/routing-boundary")
const moduleUrl = pathToFileURL(path.resolve(".vite/reader-tests/routing-boundary.mjs")).href

test.beforeAll(async () => {
  await build({ configFile: path.resolve("tests/renderer/vite.config.ts") })
})

test("shared memory routes defer the reader on direct entry and preserve one owner through StrictMode navigation", async ({
  application,
}) => {
  const result = await application.page.evaluate(async (url) => {
    const { mountRoutes }: Boundary = await import(url)
    document.getElementById("root")!.style.display = "none"
    const host = document.createElement("div")
    document.body.append(host)
    let libraries = 0
    let listeners = 0
    const mounted = mountRoutes(
      host,
      {
        getDocumentLibrary: async () => {
          libraries++
          return { selectedDocument: null, documents: [] }
        },
        openDocument: async () => null,
        activateDocument: async () => ({ selectedDocument: null, documents: [] }),
        loadDocument: async () => {
          throw new Error("No documents")
        },
        generateChat: async () => ({ text: "Test response" }),
        cancelChat: async () => {},
        getOpenRouterApiKeyStatus: async () => ({ isConfigured: false }),
        getOpenRouterApiKey: async () => null,
        saveOpenRouterApiKey: async () => {},
        getIsFullScreen: async () => false,
        onFullScreenChange: () => {
          listeners++
          return () => {
            listeners--
          }
        },
      },
      ["/settings/provider"],
    )
    // eslint-disable-next-line unicorn/consistent-function-scoping -- This function is serialized into the renderer.
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const waitFor = async (condition: () => boolean) => {
      const deadline = performance.now() + 2_000
      while (!condition()) {
        if (performance.now() >= deadline) throw new Error("Timed out waiting for route lifecycle")
        // eslint-disable-next-line no-await-in-loop -- Lifecycle frames must be observed sequentially.
        await frame()
      }
    }
    await waitFor(
      () =>
        Boolean(host.querySelector("[data-pdf-host]")) &&
        Boolean(host.querySelector('[aria-label="Settings"] h1')),
    )
    const initial = {
      heading: host.querySelector('[aria-label="Settings"] h1')?.textContent,
      libraries,
      listeners,
    }
    await mounted.router.navigate("/")
    await waitFor(() => libraries > 0 && listeners > 0)
    const activated = { libraries, listeners, host: host.querySelector("[data-pdf-host]") }
    await mounted.router.navigate("/settings")
    await waitFor(
      () => mounted.router.state.location.pathname === "/settings/general" && listeners === 0,
    )
    const redirected = mounted.router.state.location.pathname
    await mounted.router.navigate(-1)
    await waitFor(
      () => mounted.router.state.location.pathname === "/" && listeners === activated.listeners,
    )
    const returned = {
      path: mounted.router.state.location.pathname,
      libraries,
      listeners,
      sameHost: activated.host === host.querySelector("[data-pdf-host]"),
    }
    mounted.dispose()
    host.remove()
    return {
      initial,
      activated: { libraries: activated.libraries, listeners: activated.listeners },
      redirected,
      returned,
      remainingListeners: listeners,
    }
  }, moduleUrl)
  expect(result.initial).toEqual({ heading: "AI Provider", libraries: 0, listeners: 0 })
  expect(result.activated.libraries).toBeGreaterThanOrEqual(1)
  expect(result.redirected).toBe("/settings/general")
  expect(result.returned).toEqual({ path: "/", ...result.activated, sameHost: true })
  expect(result.remainingListeners).toBe(0)
})
