import type { BrowserWindow, IpcMainInvokeEvent } from "electron"

export function isTrustedRenderer(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererUrl: string,
) {
  return (
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    isSameDocument(event.senderFrame.url, rendererUrl)
  )
}

function isSameDocument(actualUrl: string, expectedUrl: string) {
  try {
    const actual = new URL(actualUrl)
    const expected = new URL(expectedUrl)

    return actual.origin === expected.origin && actual.pathname === expected.pathname
  } catch {
    return false
  }
}
