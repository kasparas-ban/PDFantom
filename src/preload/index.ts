import { contextBridge, ipcRenderer } from "electron"

import { RENDERER_API_GLOBAL, type RendererApi } from "../shared/renderer-api"
import { OPEN_TEXTBOOK_CHANNEL } from "../shared/textbook-api"

const rendererApi: RendererApi = {
  openTextbook: () => ipcRenderer.invoke(OPEN_TEXTBOOK_CHANNEL),
}

contextBridge.exposeInMainWorld(RENDERER_API_GLOBAL, rendererApi)
