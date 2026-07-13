import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron"

import {
  ACTIVATE_DOCUMENT_CHANNEL,
  GET_DOCUMENT_LIBRARY_CHANNEL,
  OPEN_DOCUMENT_CHANNEL,
} from "../shared/document-api"
import { DocumentLibrary } from "./document-library"
import { isTrustedRenderer } from "./trusted-renderer"

export function registerDocumentBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  library: DocumentLibrary,
) {
  ipcMain.handle(GET_DOCUMENT_LIBRARY_CHANNEL, async (event) => {
    assertTrustedRenderer(event, window, rendererUrl)
    return library.getSnapshot()
  })

  ipcMain.handle(OPEN_DOCUMENT_CHANNEL, async (event) => {
    assertTrustedRenderer(event, window, rendererUrl)

    const selectedPath = await choosePdf(window)
    if (!selectedPath) return null

    return library.openDocument(selectedPath)
  })

  ipcMain.handle(ACTIVATE_DOCUMENT_CHANNEL, async (event, documentId: unknown) => {
    assertTrustedRenderer(event, window, rendererUrl)
    assertDocumentId(documentId)

    return library.activateDocument(documentId)
  })
}

async function choosePdf(window: BrowserWindow) {
  const result = await dialog.showOpenDialog(window, {
    filters: [{ name: "PDF documents", extensions: ["pdf"] }],
    properties: ["openFile"],
    title: "Open a document",
  })

  return result.canceled ? null : (result.filePaths[0] ?? null)
}

function assertTrustedRenderer(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererUrl: string,
) {
  if (!isTrustedRenderer(event, window, rendererUrl)) {
    throw new Error("Document access was denied for an untrusted sender.")
  }
}

function assertDocumentId(documentId: unknown): asserts documentId is string {
  if (typeof documentId !== "string" || documentId.length === 0 || documentId.length > 200) {
    throw new Error("The Document identifier is invalid.")
  }
}
