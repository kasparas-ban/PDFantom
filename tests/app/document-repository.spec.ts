import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { DocumentRepository } from "../../src/main/document-repository"

const { DatabaseSync } = process.getBuiltinModule("node:sqlite")

type RepositoryDependencies = NonNullable<
  ConstructorParameters<typeof DocumentRepository>[1]
>

async function withDocumentRepository<T>(
  dependencies: RepositoryDependencies,
  run: (repository: DocumentRepository) => T | Promise<T>,
) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-document-repository-"))
  const repository = new DocumentRepository(
    path.join(workspace, "study-history.sqlite"),
    dependencies,
  )

  try {
    return await run(repository)
  } finally {
    repository.close()
    await rm(workspace, { force: true, recursive: true })
  }
}

test("remembers an opened Document and makes it active", async () => {
  await withDocumentRepository(
    {
      createId: () => "document-1",
      now: () => new Date("2026-07-12T10:00:00.000Z"),
    },
    (repository) => {
      const document = repository.recordOpenedDocument({
        fingerprint: "course-notes-content",
        name: "course-notes.pdf",
        sourcePath: "/documents/course-notes.pdf",
      })

      expect(document.fingerprint).toBe("course-notes-content")
      expect(repository.listDocuments()).toEqual([document])
      expect(repository.getActiveDocument()).toEqual(document)
    },
  )
})

test("keeps identical content at different paths as separate Documents", async () => {
  const ids = ["document-1", "document-2"]
  const openedAt = [
    new Date("2026-07-12T10:00:00.000Z"),
    new Date("2026-07-12T11:00:00.000Z"),
  ]

  await withDocumentRepository(
    {
      createId: () => ids.shift()!,
      now: () => openedAt.shift()!,
    },
    (repository) => {
      const original = repository.recordOpenedDocument({
        fingerprint: "same-content",
        name: "notes.pdf",
        sourcePath: "/old/notes.pdf",
      })
      const copy = repository.recordOpenedDocument({
        fingerprint: "same-content",
        name: "renamed-notes.pdf",
        sourcePath: "/new/renamed-notes.pdf",
      })

      expect(copy.id).not.toBe(original.id)
      expect(repository.listDocuments()).toEqual([copy, original])
    },
  )
})

test("updates the existing Document when its path is reopened with changed content", async () => {
  const openedAt = [
    new Date("2026-07-12T10:00:00.000Z"),
    new Date("2026-07-12T11:00:00.000Z"),
  ]

  await withDocumentRepository(
    {
      createId: () => "document-1",
      now: () => openedAt.shift()!,
    },
    (repository) => {
      const original = repository.recordOpenedDocument({
        fingerprint: "original-content",
        name: "notes.pdf",
        sourcePath: "/documents/notes.pdf",
      })
      const reopened = repository.recordOpenedDocument({
        fingerprint: "edited-content",
        name: "notes.pdf",
        sourcePath: "/documents/notes.pdf",
      })

      expect(reopened).toMatchObject({
        fingerprint: "edited-content",
        firstOpenedAt: original.firstOpenedAt,
        id: original.id,
        lastOpenedAt: "2026-07-12T11:00:00.000Z",
      })
      expect(repository.listDocuments()).toEqual([reopened])
    },
  )
})

test("restores the active Document", async () => {
  const ids = ["document-1", "document-2"]
  const openedAt = [
    new Date("2026-07-12T10:00:00.000Z"),
    new Date("2026-07-12T11:00:00.000Z"),
  ]

  await withDocumentRepository(
    {
      createId: () => ids.shift()!,
      now: () => openedAt.shift()!,
    },
    (repository) => {
      const first = repository.recordOpenedDocument({
        fingerprint: "fingerprint-1",
        name: "first.pdf",
        sourcePath: "/documents/first.pdf",
      })
      const second = repository.recordOpenedDocument({
        fingerprint: "fingerprint-2",
        name: "second.pdf",
        sourcePath: "/documents/second.pdf",
      })

      repository.activateDocument(first.id)

      expect(repository.getActiveDocument()).toEqual(first)
      expect(repository.listDocuments().map((document) => document.id)).toEqual([
        second.id,
        first.id,
      ])
    },
  )
})

test("rolls back initial schema creation when a statement fails", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-document-repository-"))
  const databasePath = path.join(workspace, "study-history.sqlite")
  const database = new DatabaseSync(databasePath)
  database.exec(`
    CREATE TABLE application_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  database.close()

  try {
    expect(() => new DocumentRepository(databasePath)).toThrow()

    const persistedDatabase = new DatabaseSync(databasePath)
    try {
      const tables = persistedDatabase
        .prepare(
          `SELECT name
           FROM sqlite_schema
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all()
        .map(({ name }) => name)

      expect(tables).toEqual(["application_state"])
      expect(persistedDatabase.prepare("PRAGMA user_version").get()).toEqual({
        user_version: 0,
      })
    } finally {
      persistedDatabase.close()
    }
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("migrates fingerprint-identified rows to one row per source path", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-document-repository-"))
  const databasePath = path.join(workspace, "study-history.sqlite")
  const database = new DatabaseSync(databasePath)
  database.exec(`
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL UNIQUE,
      source_path TEXT NOT NULL,
      name TEXT NOT NULL,
      first_opened_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL,
      last_page INTEGER NOT NULL DEFAULT 1 CHECK (last_page >= 1)
    );
    CREATE TABLE application_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO documents VALUES (
      'older-id', 'older-content', '/documents/notes.pdf', 'notes.pdf',
      '2026-07-12T10:00:00.000Z', '2026-07-12T10:00:00.000Z', 4
    );
    INSERT INTO documents VALUES (
      'newer-id', 'newer-content', '/documents/notes.pdf', 'notes.pdf',
      '2026-07-12T11:00:00.000Z', '2026-07-12T11:00:00.000Z', 2
    );
    INSERT INTO application_state VALUES ('active_document_id', 'older-id');
    PRAGMA user_version = 1;
  `)
  database.close()

  const repository = new DocumentRepository(databasePath)
  try {
    expect(repository.listDocuments()).toEqual([
      {
        fingerprint: "newer-content",
        firstOpenedAt: "2026-07-12T10:00:00.000Z",
        id: "newer-id",
        lastOpenedAt: "2026-07-12T11:00:00.000Z",
        name: "notes.pdf",
        sourcePath: "/documents/notes.pdf",
      },
    ])
    expect(repository.getActiveDocument()?.id).toBe("newer-id")
  } finally {
    repository.close()
    await rm(workspace, { force: true, recursive: true })
  }
})
