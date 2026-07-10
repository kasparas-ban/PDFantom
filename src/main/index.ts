import path from "node:path"
import { app, BrowserWindow } from "electron"
import { registerTextbookBoundary, rendererEntryUrl } from "./textbook-boundary"

if (process.env.PDFANTOM_TEST_PROFILE) {
  app.setPath("userData", process.env.PDFANTOM_TEST_PROFILE)
}

function createWindow(rendererUrl: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: "PDFantom",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  window.webContents.on("will-navigate", (event) => event.preventDefault())

  void window.loadURL(rendererUrl)

  return window
}

void app.whenReady().then(() => {
  const rendererUrl = rendererEntryUrl()
  const window = createWindow(rendererUrl)

  registerTextbookBoundary(window, rendererUrl)
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  )
})

app.on("window-all-closed", () => app.quit())
