import { startRequestProbe } from "./request-probe"
import { expect, test } from "./test"

declare global {
  namespace Electron {
    // eslint-disable-next-line typescript/consistent-type-definitions -- Declaration merging requires an interface.
    interface WebContents {
      getLastWebPreferences(): WebPreferences
    }
  }
}

test("the renderer uses hardened BrowserWindow preferences", async ({ application }) => {
  const preferences = await application.electronApplication.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) throw new Error("No application window is available")

    return window.webContents.getLastWebPreferences()
  })

  expect(preferences).toMatchObject({
    allowRunningInsecureContent: false,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    webviewTag: false,
  })
})

test("the renderer exposes only the allowlisted preload API", async ({ application }) => {
  const { page } = application
  await expect(page.getByRole("button", { name: "Choose a PDF" })).toBeVisible()

  const boundary = await page.evaluate(() => {
    const rendererWindow = window as Window & {
      ipcRenderer?: unknown
      process?: unknown
      require?: unknown
    }

    return {
      apiProperties: Object.getOwnPropertyNames(window.pdfantom).toSorted(),
      apiSymbols: Object.getOwnPropertySymbols(window.pdfantom).map(String).toSorted(),
      exposedGlobals: ["ipcRenderer", "process", "require"].filter(
        (name) => name in rendererWindow,
      ),
    }
  })

  expect(boundary).toEqual({
    apiProperties: [
      "activateDocument",
      "getDocumentLibrary",
      "getIsFullScreen",
      "onFullScreenChange",
      "openDocument",
    ],
    apiSymbols: [],
    exposedGlobals: [],
  })
})

test(
  "the renderer receives full-screen state changes",
  { tag: "@native-window" },
  async ({ application }) => {
    const { electronApplication, page } = application

    await expect(page.evaluate(() => window.pdfantom.getIsFullScreen())).resolves.toBe(false)

    const enteredFullScreen = page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const unsubscribe = window.pdfantom.onFullScreenChange((isFullScreen) => {
            unsubscribe()
            resolve(isFullScreen)
          })
        }),
    )
    await electronApplication.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error("No application window is available")

      window.setFullScreen(true)
    })

    await expect(enteredFullScreen).resolves.toBe(true)
    await expect(page.evaluate(() => window.pdfantom.getIsFullScreen())).resolves.toBe(true)
    expect(await application.hasVisibleWindow()).toBe(true)

    const leftFullScreen = page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const unsubscribe = window.pdfantom.onFullScreenChange((isFullScreen) => {
            unsubscribe()
            resolve(isFullScreen)
          })
        }),
    )
    await electronApplication.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error("No application window is available")

      window.setFullScreen(false)
    })

    await expect(leftFullScreen).resolves.toBe(false)
    await expect(page.evaluate(() => window.pdfantom.getIsFullScreen())).resolves.toBe(false)
    expect(await application.hasVisibleWindow()).toBe(true)
  },
)

test("the renderer CSP blocks network connections before a request is sent", async ({
  application,
}) => {
  const { page } = application
  const probe = await startRequestProbe()

  try {
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content")
    expect(policy?.split(";").map((directive) => directive.trim())).toContain("connect-src 'none'")

    const fetchResult = await page.evaluate(async (url) => {
      try {
        await fetch(url)
        return "allowed"
      } catch {
        return "blocked"
      }
    }, probe.url)

    expect(fetchResult).toBe("blocked")
    expect(probe.requestCount).toBe(0)
  } finally {
    await probe.close()
  }
})

test("the renderer denies user-initiated new windows", async ({ application }) => {
  const { page } = application
  await page.evaluate(() => {
    const rendererWindow = window as Window & { popupDenied?: boolean }
    const button = document.createElement("button")
    button.textContent = "Open external window"
    button.addEventListener("click", () => {
      rendererWindow.popupDenied = window.open("https://example.invalid/") === null
    })
    document.body.append(button)
  })

  await page.getByRole("button", { name: "Open external window" }).click()

  expect(
    await page.evaluate(() => (window as Window & { popupDenied?: boolean }).popupDenied),
  ).toBe(true)
})

test("the renderer prevents attempted top-level navigation", async ({ application }) => {
  const { electronApplication, page } = application
  const originalUrl = page.url()
  const targetUrl = "https://example.invalid/"

  await electronApplication.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) throw new Error("No application window is available")

    const navigationAttempt = new Promise<{
      readonly defaultPrevented: boolean
      readonly url: string
    }>((resolve) => {
      window.webContents.once("will-navigate", (event, url) => {
        resolve({ defaultPrevented: event.defaultPrevented, url })
      })
    })
    Reflect.set(globalThis, Symbol.for("pdfantom.test.navigationAttempt"), navigationAttempt)
  })

  await page.evaluate((url) => window.location.assign(url), targetUrl)

  const navigation = await electronApplication.evaluate(async () => {
    const probeKey = Symbol.for("pdfantom.test.navigationAttempt")
    const navigationAttempt = Reflect.get(globalThis, probeKey)
    if (!(navigationAttempt instanceof Promise)) {
      throw new Error("Navigation attempt observer was not armed")
    }

    try {
      return await navigationAttempt
    } finally {
      Reflect.deleteProperty(globalThis, probeKey)
    }
  })

  expect(navigation).toEqual({
    defaultPrevented: true,
    url: targetUrl,
  })
  expect(page.url()).toBe(originalUrl)
})
