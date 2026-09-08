import path from "node:path"

import { app, BrowserWindow, safeStorage } from "electron"

import { resolveApplicationLaunchConfiguration } from "../shared/application-launch"
import { registerChatBoundary } from "./chat-boundary"
import { registerChatModelsBoundary } from "./chat-models-boundary"
import { registerChatThreadBoundary } from "./chat-thread-boundary"
import { ChatThreadRepository } from "./chat-thread-repository"
import { CodexSession } from "./codex/session"
import { registerDocumentBoundary } from "./document-boundary"
import { DocumentLibrary } from "./document-library"
import { DocumentRepository } from "./document-repository"
import { OpenRouterApiKeyStore } from "./openrouter-api-key-store"
import { rendererEntryUrl } from "./renderer-entry"
import { registerSettingsBoundary } from "./settings-boundary"
import { SettingsStore } from "./settings-store"
import { StudyHistoryDatabase } from "./study-history-database"
import { registerWindowBoundary } from "./window-boundary"

const launchConfiguration = resolveApplicationLaunchConfiguration({
  commandLine: process.argv,
  isPackaged: app.isPackaged,
  platform: process.platform,
})

if (launchConfiguration.activationPolicy) {
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
  const studyHistory = new StudyHistoryDatabase(
    path.join(app.getPath("userData"), "study-history.sqlite"),
  )
  const repository = new DocumentRepository(studyHistory)
  const chatThreads = new ChatThreadRepository(studyHistory)
  const library = new DocumentLibrary(repository)
  const apiKeyStore = new OpenRouterApiKeyStore(
    path.join(app.getPath("userData"), "secrets", "openrouter-api-key"),
    safeStorage,
  )
  const settingsStore = new SettingsStore(path.join(app.getPath("userData"), "settings.json"))
  const codexSession = new CodexSession(settingsStore)
  const window = createWindow()

  const chatBoundary = registerChatBoundary(
    window,
    rendererUrl,
    apiKeyStore,
    codexSession,
    chatThreads,
  )
  registerChatModelsBoundary(window, rendererUrl, codexSession)
  registerChatThreadBoundary(window, rendererUrl, chatThreads, {
    onDeleteThread: (threadId) => chatBoundary.abortConversation(threadId),
  })
  registerDocumentBoundary(window, rendererUrl, library)
  registerSettingsBoundary(window, rendererUrl, apiKeyStore, settingsStore, codexSession)
  registerWindowBoundary(window, rendererUrl)
  window.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) =>
    callback(permission === "clipboard-sanitized-write"),
  )
  app.once("before-quit", () => {
    codexSession.dispose()
    studyHistory.close()
  })

  void window.loadURL(rendererUrl)
})

app.on("window-all-closed", () => app.quit())
