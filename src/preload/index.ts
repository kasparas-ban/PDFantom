import { contextBridge, ipcRenderer } from "electron"

import { RENDERER_API_GLOBAL, type RendererApi } from "../shared/renderer-api"
import { OPEN_TEXTBOOK_CHANNEL } from "../shared/textbook-api"
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
  openTextbook: () => ipcRenderer.invoke(OPEN_TEXTBOOK_CHANNEL),
}

contextBridge.exposeInMainWorld(RENDERER_API_GLOBAL, rendererApi)
