import { contextBridge, ipcRenderer } from "electron"

import { RENDERER_API_GLOBAL, type RendererApi } from "../shared/renderer-api"
import { OPEN_DOCUMENT_CHANNEL } from "../shared/document-api"
import {
  FULL_SCREEN_CHANGED_CHANNEL,
  GET_FULL_SCREEN_CHANNEL,
} from "../shared/window-api"

const rendererApi: RendererApi = {
  getIsFullScreen: () => ipcRenderer.invoke(GET_FULL_SCREEN_CHANNEL),
  onFullScreenChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, isFullScreen: boolean) => {
      listener(isFullScreen)
    }

    ipcRenderer.on(FULL_SCREEN_CHANGED_CHANNEL, handler)

    return () => ipcRenderer.removeListener(FULL_SCREEN_CHANGED_CHANNEL, handler)
  },
  openDocument: () => ipcRenderer.invoke(OPEN_DOCUMENT_CHANNEL),
}

contextBridge.exposeInMainWorld(RENDERER_API_GLOBAL, rendererApi)
