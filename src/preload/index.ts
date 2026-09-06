import { contextBridge, ipcRenderer } from "electron"

import {
  LIST_PROVIDER_MODELS_CHANNEL,
  STREAM_CHAT_CHANNEL,
  type ChatModelSourceId,
  type ChatStreamEvent,
} from "../shared/chat-api"
import {
  ACTIVATE_DOCUMENT_CHANNEL,
  GET_DOCUMENT_LIBRARY_CHANNEL,
  LOAD_DOCUMENT_CHANNEL,
  OPEN_DOCUMENT_CHANNEL,
} from "../shared/document-api"
import { RENDERER_API_GLOBAL, type RendererApi } from "../shared/renderer-api"
import {
  GET_OPENROUTER_API_KEY_CHANNEL,
  GET_OPENROUTER_API_KEY_STATUS_CHANNEL,
  SAVE_OPENROUTER_API_KEY_CHANNEL,
} from "../shared/settings-api"
import { FULL_SCREEN_CHANGED_CHANNEL, GET_FULL_SCREEN_CHANNEL } from "../shared/window-api"

const rendererApi: RendererApi = {
  streamChat: (request, onEvent) => {
    const { port1, port2 } = new MessageChannel()
    let stopped = false

    function stop() {
      if (stopped) return

      stopped = true
      port1.removeEventListener("message", handleMessage)
      port1.close()
    }

    function handleMessage(event: MessageEvent<ChatStreamEvent>) {
      const isTerminal = event.data.type === "done" || event.data.type === "error"

      try {
        onEvent(event.data)
      } finally {
        if (isTerminal) stop()
      }
    }

    port1.addEventListener("message", handleMessage)
    port1.start()
    ipcRenderer.postMessage(STREAM_CHAT_CHANNEL, request, [port2])

    return stop
  },
  activateDocument: (documentId, fingerprint) =>
    ipcRenderer.invoke(ACTIVATE_DOCUMENT_CHANNEL, documentId, fingerprint),
  loadDocument: (documentId, fingerprint, bytesNeeded) =>
    ipcRenderer.invoke(LOAD_DOCUMENT_CHANNEL, documentId, fingerprint, bytesNeeded),
  getDocumentLibrary: () => ipcRenderer.invoke(GET_DOCUMENT_LIBRARY_CHANNEL),
  getIsFullScreen: () => ipcRenderer.invoke(GET_FULL_SCREEN_CHANNEL),
  getOpenRouterApiKey: () => ipcRenderer.invoke(GET_OPENROUTER_API_KEY_CHANNEL),
  getOpenRouterApiKeyStatus: () => ipcRenderer.invoke(GET_OPENROUTER_API_KEY_STATUS_CHANNEL),
  listProviderModels: (source: ChatModelSourceId) =>
    ipcRenderer.invoke(LIST_PROVIDER_MODELS_CHANNEL, source),
  onFullScreenChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, isFullScreen: boolean) => {
      listener(isFullScreen)
    }

    ipcRenderer.on(FULL_SCREEN_CHANGED_CHANNEL, handler)

    return () => ipcRenderer.removeListener(FULL_SCREEN_CHANGED_CHANNEL, handler)
  },
  openDocument: () => ipcRenderer.invoke(OPEN_DOCUMENT_CHANNEL),
  saveOpenRouterApiKey: (apiKey) => ipcRenderer.invoke(SAVE_OPENROUTER_API_KEY_CHANNEL, apiKey),
}

contextBridge.exposeInMainWorld(RENDERER_API_GLOBAL, rendererApi)
