import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { DocumentLibrary } from "../../src/main/document-library"
import { DocumentRepository } from "../../src/main/document-repository"

const fingerprint = "a".repeat(64)
const bytes = new ArrayBuffer(4)

async function withLibrary(
  run: (repository: DocumentRepository, workspace: string) => Promise<void>,
) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-library-"))
  const repository = new DocumentRepository(path.join(workspace, "study-history.sqlite"))
  try {
    await run(repository, workspace)
  } finally {
    repository.close()
    await rm(workspace, { recursive: true, force: true })
  }
}

const record = (repository: DocumentRepository, name: string) =>
  repository.recordOpenedDocument({ fingerprint, name, sourcePath: `/documents/${name}` })

test("empty metadata and snapshots never read source files", async () => {
  await withLibrary(async (repository) => {
    let reads = 0
    const library = new DocumentLibrary(repository, async () => {
      reads++
      return { bytes, fingerprint }
    })
    expect(await library.getSnapshot()).toEqual({ selectedDocument: null, documents: [] })
    const first = record(repository, "first.pdf")
    const second = record(repository, "second.pdf")
    const snapshot = await library.activateDocument(first.id, fingerprint)
    expect(snapshot.selectedDocument).toEqual({ id: first.id, name: first.name, fingerprint })
    expect(snapshot.documents).toHaveLength(2)
    expect(JSON.stringify(snapshot)).not.toContain("sourcePath")
    expect(JSON.stringify(snapshot)).not.toContain("bytes")
    await library.activateDocument(second.id, fingerprint)
    expect(reads).toBe(0)
  })
})

test("selection and metadata proceed in request order while full reads are pending", async () => {
  await withLibrary(async (repository) => {
    const first = record(repository, "first.pdf")
    const second = record(repository, "second.pdf")
    const pending = Promise.withResolvers<{ bytes: ArrayBuffer; fingerprint: string }>()
    let reads = 0
    const library = new DocumentLibrary(repository, () => {
      reads++
      return pending.promise
    })
    const load = library.loadDocument(first.id, fingerprint, true)
    const check = library.loadDocument(first.id, fingerprint, false)
    expect(reads).toBe(1)
    await library.activateDocument(first.id, fingerprint)
    await library.activateDocument(second.id, fingerprint)
    expect((await library.getSnapshot()).selectedDocument?.id).toBe(second.id)
    pending.resolve({ bytes, fingerprint })
    expect(await load).toMatchObject({ status: "verified", bytes })
    expect(await check).not.toHaveProperty("bytes")
    expect(repository.getActiveDocument()?.id).toBe(second.id)
    await library.loadDocument(first.id, fingerprint, false)
    expect(reads).toBe(2)
  })
})

test("open records without selecting and reports the previous version", async () => {
  await withLibrary(async (repository) => {
    const first = record(repository, "first.pdf")
    repository.activateDocument(first.id)
    let content = fingerprint
    const library = new DocumentLibrary(repository, async () => ({ bytes, fingerprint: content }))
    const opened = await library.openDocument("/documents/second.pdf")
    expect(opened.previousFingerprint).toBeNull()
    expect(opened.library.selectedDocument?.id).toBe(first.id)
    content = "b".repeat(64)
    const replacement = await library.openDocument("/documents/second.pdf")
    expect(replacement.previousFingerprint).toBe(fingerprint)
    expect(replacement.document.id).toBe(opened.document.id)
    expect(repository.getActiveDocument()?.id).toBe(first.id)
    await expect(library.activateDocument(opened.document.id, fingerprint)).rejects.toThrow(
      "version changed",
    )
  })
})

test("checks the authoritative fingerprint again after an in-flight read", async () => {
  await withLibrary(async (repository) => {
    const document = record(repository, "first.pdf")
    const pending = Promise.withResolvers<{ bytes: ArrayBuffer; fingerprint: string }>()
    const library = new DocumentLibrary(repository, () => pending.promise)
    const load = library.loadDocument(document.id, fingerprint, true)
    repository.recordOpenedDocument({ ...document, fingerprint: "b".repeat(64) })
    pending.resolve({ bytes, fingerprint })
    expect(await load).toMatchObject({ status: "unavailable", reason: "content-mismatch" })
  })
})

test("a late picker read cannot replace the repository version recorded by a newer open", async () => {
  await withLibrary(async (repository) => {
    const older = Promise.withResolvers<{ bytes: ArrayBuffer; fingerprint: string }>()
    let reads = 0
    const library = new DocumentLibrary(repository, () =>
      ++reads === 1 ? older.promise : Promise.resolve({ bytes, fingerprint: "b".repeat(64) }),
    )
    const stale = library.openDocument("/documents/same.pdf")
    const rejection = expect(stale).rejects.toThrow("superseded")
    const current = await library.openDocument("/documents/same.pdf")
    older.resolve({ bytes, fingerprint })
    await rejection
    expect(repository.findDocument(current.document.id)?.fingerprint).toBe("b".repeat(64))
    expect(repository.getActiveDocument()).toBeNull()
  })
})

test("rejects unknown IDs and never trusts the renderer's expected fingerprint", async () => {
  await withLibrary(async (repository) => {
    const library = new DocumentLibrary(repository)
    await expect(library.loadDocument("unknown", fingerprint, true)).rejects.toThrow(
      "does not exist",
    )
    const document = record(repository, "notes.pdf")
    expect(await library.loadDocument(document.id, "b".repeat(64), false)).toMatchObject({
      status: "unavailable",
      reason: "content-mismatch",
    })
  })
})

for (const reason of ["missing", "invalid", "unreadable", "content-mismatch"] as const) {
  test(`preserves the ${reason} source failure without mutating selection`, async () => {
    await withLibrary(async (repository, workspace) => {
      const sourcePath = path.join(workspace, "source.pdf")
      if (reason === "invalid") await writeFile(sourcePath, "Not a PDF")
      if (reason === "content-mismatch") await writeFile(sourcePath, "%PDF-1.4\nchanged content")
      const document = repository.recordOpenedDocument({
        fingerprint,
        name: "source.pdf",
        sourcePath,
      })
      const library =
        reason === "unreadable"
          ? new DocumentLibrary(repository, async () => {
              throw new Error("denied")
            })
          : new DocumentLibrary(repository)
      expect(await library.loadDocument(document.id, fingerprint, true)).toMatchObject({
        status: "unavailable",
        reason,
      })
      expect(repository.getActiveDocument()).toBeNull()
    })
  })
}
