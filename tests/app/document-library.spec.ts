import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { DocumentLibrary } from "../../src/main/document-library"
import { DocumentRepository } from "../../src/main/document-repository"

async function withDocumentLibrary(
  run: (repository: DocumentRepository, workspace: string) => Promise<void>,
) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-document-library-"))
  const ids = ["document-1", "document-2"]
  const openedAt = [
    new Date("2026-07-12T10:00:00.000Z"),
    new Date("2026-07-12T11:00:00.000Z"),
  ]
  const repository = new DocumentRepository(path.join(workspace, "study-history.sqlite"), {
    createId: () => ids.shift()!,
    now: () => openedAt.shift()!,
  })

  try {
    await run(repository, workspace)
  } finally {
    repository.close()
    await rm(workspace, { force: true, recursive: true })
  }
}

test("reports no active Document for an empty library", async () => {
  await withDocumentLibrary(async (repository) => {
    const library = new DocumentLibrary(repository)

    await expect(library.getSnapshot()).resolves.toEqual({
      activeDocument: { status: "none" },
      documents: [],
    })
  })
})

test("loads only the active Document when restoring a library snapshot", async () => {
  await withDocumentLibrary(async (repository) => {
    const first = repository.recordOpenedDocument({
      fingerprint: "first-content",
      name: "first.pdf",
      sourcePath: "/documents/first.pdf",
    })
    const second = repository.recordOpenedDocument({
      fingerprint: "second-content",
      name: "second.pdf",
      sourcePath: "/documents/second.pdf",
    })
    repository.activateDocument(first.id)

    const loadedPaths = new Array<string>()
    const library = new DocumentLibrary(repository, async (sourcePath) => {
      loadedPaths.push(sourcePath)
      return {
        bytes: new ArrayBuffer(0),
        fingerprint: sourcePath === first.sourcePath ? "first-content" : second.fingerprint,
      }
    })

    const snapshot = await library.getSnapshot()

    expect(loadedPaths).toEqual([first.sourcePath])
    expect(snapshot.activeDocument).toMatchObject({
      document: { id: first.id, name: first.name },
      status: "loaded",
    })
    expect(
      snapshot.activeDocument.status === "loaded"
        ? snapshot.activeDocument.document.bytes.byteLength
        : undefined,
    ).toBe(0)
    expect(snapshot.documents).toEqual([
      { id: second.id, name: second.name },
      { id: first.id, name: first.name },
    ])
  })
})

test("serializes Document activations in request order", async () => {
  await withDocumentLibrary(async (repository) => {
    const first = repository.recordOpenedDocument({
      fingerprint: "first-content",
      name: "first.pdf",
      sourcePath: "/documents/first.pdf",
    })
    const second = repository.recordOpenedDocument({
      fingerprint: "second-content",
      name: "second.pdf",
      sourcePath: "/documents/second.pdf",
    })
    const firstLoad = Promise.withResolvers<{
      bytes: ArrayBuffer
      fingerprint: string
    }>()
    const secondLoad = Promise.withResolvers<{
      bytes: ArrayBuffer
      fingerprint: string
    }>()
    const loadedPaths = new Array<string>()
    const library = new DocumentLibrary(repository, (sourcePath) => {
      loadedPaths.push(sourcePath)
      return sourcePath === first.sourcePath ? firstLoad.promise : secondLoad.promise
    })

    const firstActivation = library.activateDocument(first.id)
    await expect.poll(() => loadedPaths).toEqual([first.sourcePath])

    const secondActivation = library.activateDocument(second.id)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(loadedPaths).toEqual([first.sourcePath])

    firstLoad.resolve({ bytes: new ArrayBuffer(0), fingerprint: first.fingerprint })
    expect((await firstActivation).activeDocument).toMatchObject({
      document: { id: first.id },
      status: "loaded",
    })
    await expect.poll(() => loadedPaths).toEqual([first.sourcePath, second.sourcePath])

    secondLoad.resolve({ bytes: new ArrayBuffer(0), fingerprint: second.fingerprint })
    expect((await secondActivation).activeDocument).toMatchObject({
      document: { id: second.id },
      status: "loaded",
    })
  })
})

test("rejects a saved Document after its content changes at the same path", async () => {
  await withDocumentLibrary(async (repository) => {
    const document = repository.recordOpenedDocument({
      fingerprint: "original-content",
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    const library = new DocumentLibrary(repository, async () => ({
      bytes: new ArrayBuffer(0),
      fingerprint: "edited-content",
    }))

    await expect(library.activateDocument(document.id)).rejects.toThrow(
      "The saved Document no longer matches its original content.",
    )
  })
})

test("reports a mismatched active Document as unavailable when restoring", async () => {
  await withDocumentLibrary(async (repository) => {
    const document = repository.recordOpenedDocument({
      fingerprint: "original-content",
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    const library = new DocumentLibrary(repository, async () => ({
      bytes: new ArrayBuffer(0),
      fingerprint: "replacement-content",
    }))

    const snapshot = await library.getSnapshot()

    expect(snapshot.activeDocument).toEqual({
      document: { id: document.id, name: document.name },
      reason: "content-mismatch",
      status: "unavailable",
    })
  })
})

test("reports a missing active Document as unavailable when restoring", async () => {
  await withDocumentLibrary(async (repository) => {
    const document = repository.recordOpenedDocument({
      fingerprint: "original-content",
      name: "missing.pdf",
      sourcePath: "/documents/missing.pdf",
    })
    const library = new DocumentLibrary(repository)

    const snapshot = await library.getSnapshot()

    expect(snapshot.activeDocument).toEqual({
      document: { id: document.id, name: document.name },
      reason: "missing",
      status: "unavailable",
    })
  })
})

test("reports an invalid active Document as unavailable when restoring", async () => {
  await withDocumentLibrary(async (repository, workspace) => {
    const sourcePath = path.join(workspace, "corrupted.pdf")
    await writeFile(sourcePath, "This is no longer a PDF.")
    const document = repository.recordOpenedDocument({
      fingerprint: "original-content",
      name: "corrupted.pdf",
      sourcePath,
    })
    const library = new DocumentLibrary(repository)

    const snapshot = await library.getSnapshot()

    expect(snapshot.activeDocument).toEqual({
      document: { id: document.id, name: document.name },
      reason: "invalid",
      status: "unavailable",
    })
  })
})
