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
    await frame()
    await frame()
    const initial = { heading: host.querySelector("h1")?.textContent, libraries, listeners }
    await mounted.router.navigate("/")
    await frame()
    await frame()
    const activated = { libraries, listeners, host: host.querySelector("[data-pdf-host]") }
    await mounted.router.navigate("/settings")
    await frame()
    await frame()
    const redirected = mounted.router.state.location.pathname
    await mounted.router.navigate(-1)
    await frame()
    await frame()
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
