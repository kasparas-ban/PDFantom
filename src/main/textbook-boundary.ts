import { readFile } from "node:fs/promises"
import path from "node:path"

import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron"

import { OPEN_TEXTBOOK_CHANNEL } from "../shared/textbook-api"

const PDF_HEADER = "%PDF-"

export function registerTextbookBoundary(window: BrowserWindow, rendererUrl: string) {
  ipcMain.handle(OPEN_TEXTBOOK_CHANNEL, async (event) => {
    if (!isTrustedSender(event, window, rendererUrl)) {
      throw new Error("Textbook access was denied for an untrusted sender.")
    }

    const selectedPath = await choosePdf(window)
    return selectedPath ? readPdf(selectedPath) : null
  })
}

function isTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow, rendererUrl: string) {
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

async function choosePdf(window: BrowserWindow) {
  const result = await dialog.showOpenDialog(window, {
    filters: [{ name: "PDF documents", extensions: ["pdf"] }],
    properties: ["openFile"],
    title: "Open a textbook",
  })

  return result.canceled ? null : (result.filePaths[0] ?? null)
}

async function readPdf(filePath: string) {
  if (path.extname(filePath).toLowerCase() !== ".pdf") {
    throw new Error("The selected file is not a PDF.")
  }

  const file = await readFile(filePath)
  if (file.subarray(0, PDF_HEADER.length).toString("ascii") !== PDF_HEADER) {
    throw new Error("The selected file does not contain a valid PDF header.")
  }

  const bytes = Uint8Array.from(file).buffer
  return { bytes, name: path.basename(filePath) }
}
