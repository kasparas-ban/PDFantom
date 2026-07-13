import path from "node:path"

import { app, BrowserWindow } from "electron"

import { resolveApplicationLaunchConfiguration } from "../shared/application-launch"
import { registerDocumentBoundary } from "./document-boundary"
import { DocumentLibrary } from "./document-library"
import { DocumentRepository } from "./document-repository"
import { rendererEntryUrl } from "./renderer-entry"
import { registerWindowBoundary } from "./window-boundary"

const launchConfiguration = resolveApplicationLaunchConfiguration({
  commandLine: process.argv,
  isPackaged: app.isPackaged,
  platform: process.platform,
})

if (launchConfiguration.activationPolicy !== undefined) {
  app.setActivationPolicy(launchConfiguration.activationPolicy)
}

function createWindow() {
  const window = new BrowserWindow({
    backgroundColor: "#f6f5f3",
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 560,
    title: "PDFantom",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    show: launchConfiguration.showWindow,
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

  return window
}

void app.whenReady().then(() => {
  if (launchConfiguration.setDevelopmentDockIcon) {
    app.dock?.setIcon(path.resolve("assets/pdfantom-logo.png"))
  }

  const rendererUrl = rendererEntryUrl()
  const repository = new DocumentRepository(
    path.join(app.getPath("userData"), "study-history.sqlite"),
  )
  const library = new DocumentLibrary(repository)
  const window = createWindow()

  registerDocumentBoundary(window, rendererUrl, library)
  registerWindowBoundary(window, rendererUrl)
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  )
  app.once("before-quit", () => repository.close())

  void window.loadURL(rendererUrl)
})

app.on("window-all-closed", () => app.quit())
