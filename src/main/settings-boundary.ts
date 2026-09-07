import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron"

import {
  GET_CODEX_SETTINGS_CHANNEL,
  GET_OPENROUTER_API_KEY_CHANNEL,
  GET_OPENROUTER_API_KEY_STATUS_CHANNEL,
  SAVE_CODEX_EXECUTABLE_PATH_CHANNEL,
  SAVE_OPENROUTER_API_KEY_CHANNEL,
  type CodexSettings,
} from "../shared/settings-api"
import type { CodexSession } from "./codex/session"
import { OpenRouterApiKeyStore } from "./openrouter-api-key-store"
import type { SettingsStore } from "./settings-store"
import { isTrustedRenderer } from "./trusted-renderer"

export function registerSettingsBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  apiKeyStore: OpenRouterApiKeyStore,
  settingsStore: SettingsStore,
  codexSession: CodexSession,
) {
  const readCodexSettings = async (): Promise<CodexSettings> => ({
    executablePathOverride: (await settingsStore.read()).codexExecutablePath ?? null,
    session: await codexSession.status(),
  })

  ipcMain.handle(GET_OPENROUTER_API_KEY_CHANNEL, async (event) => {
    assertTrustedRenderer(event, window, rendererUrl)
    return apiKeyStore.getApiKey()
  })

  ipcMain.handle(GET_OPENROUTER_API_KEY_STATUS_CHANNEL, async (event) => {
    assertTrustedRenderer(event, window, rendererUrl)
    return { isConfigured: await apiKeyStore.hasApiKey() }
  })

  ipcMain.handle(SAVE_OPENROUTER_API_KEY_CHANNEL, async (event, apiKey: unknown) => {
    assertTrustedRenderer(event, window, rendererUrl)
    assertShortString(apiKey, "The OpenRouter API key is invalid.")
    await apiKeyStore.saveApiKey(apiKey.trim())
  })

  ipcMain.handle(GET_CODEX_SETTINGS_CHANNEL, async (event) => {
    assertTrustedRenderer(event, window, rendererUrl)
    return readCodexSettings()
  })

  ipcMain.handle(SAVE_CODEX_EXECUTABLE_PATH_CHANNEL, async (event, executablePath: unknown) => {
    assertTrustedRenderer(event, window, rendererUrl)
    assertShortString(executablePath, "The Codex executable path is invalid.")
    await settingsStore.write({ codexExecutablePath: executablePath.trim() || undefined })
    return readCodexSettings()
  })
}

function assertTrustedRenderer(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererUrl: string,
) {
  if (!isTrustedRenderer(event, window, rendererUrl)) {
    throw new Error("Settings access was denied for an untrusted sender.")
  }
}

function assertShortString(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || value.length > 10_000) throw new Error(message)
}
