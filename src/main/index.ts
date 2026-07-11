import path from "node:path"

import { app, BrowserWindow } from "electron"

import { rendererEntryUrl } from "./renderer-entry"
import { registerTextbookBoundary } from "./textbook-boundary"

function createWindow(rendererUrl: string) {
  const window = new BrowserWindow({
    backgroundColor: "#f6f5f3",
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: "PDFantom",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  window.webContents.on("will-navigate", (event) => event.preventDefault())

  void window.loadURL(rendererUrl)

  return window
}

void app.whenReady().then(() => {
  if (process.platform === "darwin" && !app.isPackaged) {
    app.dock?.setIcon(path.resolve("assets/pdfantom-logo.png"))
  }

  const rendererUrl = rendererEntryUrl()
  const window = createWindow(rendererUrl)

  registerTextbookBoundary(window, rendererUrl)
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  )
})

app.on("window-all-closed", () => app.quit())
