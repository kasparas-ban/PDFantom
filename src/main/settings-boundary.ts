import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron"

import {
  GET_OPENROUTER_API_KEY_CHANNEL,
  GET_OPENROUTER_API_KEY_STATUS_CHANNEL,
  SAVE_OPENROUTER_API_KEY_CHANNEL,
} from "../shared/settings-api"
import { OpenRouterApiKeyStore } from "./openrouter-api-key-store"
import { isTrustedRenderer } from "./trusted-renderer"

export function registerSettingsBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  apiKeyStore: OpenRouterApiKeyStore,
) {
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
    assertApiKey(apiKey)
    await apiKeyStore.saveApiKey(apiKey)
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

function assertApiKey(apiKey: unknown): asserts apiKey is string {
  if (
    typeof apiKey !== "string" ||
    apiKey.trim().length === 0 ||
    apiKey.length > 10_000
  ) {
    throw new Error("The OpenRouter API key is invalid.")
  }
}
