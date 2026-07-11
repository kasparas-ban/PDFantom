import { ipcMain, type BrowserWindow } from "electron"

import {
  FULL_SCREEN_CHANGED_CHANNEL,
  GET_FULL_SCREEN_CHANNEL,
} from "../shared/window-api"
import { isTrustedRenderer } from "./trusted-renderer"

export function registerWindowBoundary(window: BrowserWindow, rendererUrl: string) {
  ipcMain.handle(GET_FULL_SCREEN_CHANNEL, (event) => {
    if (!isTrustedRenderer(event, window, rendererUrl)) {
      throw new Error("Window state access was denied for an untrusted sender.")
    }

    return window.isFullScreen()
  })

  const publishFullScreen = () => {
    window.webContents.send(FULL_SCREEN_CHANGED_CHANNEL, window.isFullScreen())
  }

  window.on("enter-full-screen", publishFullScreen)
  window.on("leave-full-screen", publishFullScreen)
}
