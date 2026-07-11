import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron"

import { OPEN_TEXTBOOK_CHANNEL, type OpenedTextbook } from "../shared/textbook-api"

const PDF_HEADER = "%PDF-"

function isSameDocument(actualUrl: string, expectedUrl: string): boolean {
  try {
    const actual = new URL(actualUrl)
    const expected = new URL(expectedUrl)

    return actual.origin === expected.origin && actual.pathname === expected.pathname
  } catch {
    return false
  }
}

function isTrustedSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererUrl: string,
): boolean {
  return (
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    isSameDocument(event.senderFrame.url, rendererUrl)
  )
}

async function choosePdf(window: BrowserWindow): Promise<string | null> {
  const testSelection = app.isPackaged ? undefined : process.env.PDFANTOM_TEST_OPEN_PATH
  if (testSelection && process.env.PDFANTOM_TEST_PROFILE) {
    return testSelection
  }

  const result = await dialog.showOpenDialog(window, {
    filters: [{ name: "PDF documents", extensions: ["pdf"] }],
    properties: ["openFile"],
    title: "Open a textbook",
  })

  return result.canceled ? null : (result.filePaths[0] ?? null)
}

async function readPdf(filePath: string): Promise<OpenedTextbook> {
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

export function rendererEntryUrl(): string {
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return MAIN_WINDOW_VITE_DEV_SERVER_URL
  }

  const rendererName =
    typeof MAIN_WINDOW_VITE_NAME === "undefined" ? "main_window" : MAIN_WINDOW_VITE_NAME
  return pathToFileURL(path.join(__dirname, `../renderer/${rendererName}/index.html`)).href
}

export function registerTextbookBoundary(window: BrowserWindow, rendererUrl: string): void {
  ipcMain.handle(OPEN_TEXTBOOK_CHANNEL, async (event) => {
    if (!isTrustedSender(event, window, rendererUrl)) {
      throw new Error("Textbook access was denied for an untrusted sender.")
    }

    const selectedPath = await choosePdf(window)
    return selectedPath ? readPdf(selectedPath) : null
  })
}
