import { contextBridge, ipcRenderer } from "electron"

import { OPEN_TEXTBOOK_CHANNEL, type TextbookApi } from "../shared/textbook-api"

const textbookApi: TextbookApi = {
  openTextbook: () => ipcRenderer.invoke(OPEN_TEXTBOOK_CHANNEL),
}

contextBridge.exposeInMainWorld("pdfantom", textbookApi)
