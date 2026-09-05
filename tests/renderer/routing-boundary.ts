import { createElement, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import { PlatformContext, type Platform } from "../../src/renderer/src/app/platform"
import { routes } from "../../src/renderer/src/app/routes"

export function mountRoutes(host: HTMLElement, platform: Platform, initialEntries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries })
  const root = createRoot(host)
  root.render(
    createElement(
      StrictMode,
      null,
      createElement(
        PlatformContext,
        { value: platform },
        createElement(RouterProvider, { router }),
      ),
    ),
  )
  return {
    router,
    dispose: () => {
      root.unmount()
      router.dispose()
    },
  }
}
