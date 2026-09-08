import { randomUUID } from "node:crypto"
import type { DatabaseSync as Database, SQLOutputValue } from "node:sqlite"

import type { StudyHistoryDatabase } from "./study-history-database"

export type StoredDocument = {
  readonly fingerprint: string
  readonly firstOpenedAt: string
  readonly id: string
  readonly lastOpenedAt: string
  readonly name: string
  readonly sourcePath: string
}

type OpenedDocumentRecord = {
  readonly fingerprint: string
  readonly name: string
  readonly sourcePath: string
}

type DocumentRepositoryDependencies = {
  readonly createId?: () => string
  readonly now?: () => Date
}

const DOCUMENT_COLUMNS = `
  id,
  fingerprint,
  source_path,
  name,
  first_opened_at,
  last_opened_at
`

export class DocumentRepository {
  private readonly createId: () => string
  private readonly database: Database
  private readonly now: () => Date

  constructor(
    private readonly studyHistory: StudyHistoryDatabase,
    dependencies: DocumentRepositoryDependencies = {},
  ) {
    this.createId = dependencies.createId ?? randomUUID
    this.database = studyHistory.connection
    this.now = dependencies.now ?? (() => new Date())
  }

  activateDocument(documentId: string) {
    const document = this.findDocument(documentId)
    if (!document) throw new Error("The requested Document does not exist.")

    this.setActiveDocumentId(documentId)
    return document
  }

  findDocument(documentId: string) {
    const row = this.database
      .prepare(`SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE id = ?`)
      .get(documentId)

    return row ? mapDocument(row) : null
  }

  getActiveDocument() {
    const row = this.database
      .prepare(
        `SELECT ${DOCUMENT_COLUMNS}
         FROM documents
         WHERE id = (SELECT value FROM application_state WHERE key = 'active_document_id')`,
      )
      .get()

    return row ? mapDocument(row) : null
  }

  listDocuments() {
    const rows = this.database
      .prepare(
        `SELECT ${DOCUMENT_COLUMNS}
         FROM documents
         ORDER BY first_opened_at DESC`,
      )
      .all()

    return rows.map(mapDocument)
  }

  recordOpenedDocument(record: OpenedDocumentRecord) {
    const openedAt = this.now().toISOString()

    return this.studyHistory.inTransaction(() => {
      this.database
        .prepare(
          `INSERT INTO documents (
             id, fingerprint, source_path, name, first_opened_at, last_opened_at
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(source_path) DO UPDATE SET
             fingerprint = excluded.fingerprint,
             name = excluded.name,
             last_opened_at = excluded.last_opened_at`,
        )
        .run(
          this.createId(),
          record.fingerprint,
          record.sourcePath,
          record.name,
          openedAt,
          openedAt,
        )

      const document = this.findBySourcePath(record.sourcePath)
      if (!document) throw new Error("The opened Document could not be persisted.")

      return document
    })
  }

  findBySourcePath(sourcePath: string) {
    const row = this.database
      .prepare(`SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE source_path = ?`)
      .get(sourcePath)

    return row ? mapDocument(row) : null
  }

  private setActiveDocumentId(documentId: string) {
    this.database
      .prepare(
        `INSERT INTO application_state (key, value)
         VALUES ('active_document_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(documentId)
  }
}

function mapDocument(row: Record<string, SQLOutputValue>) {
  const {
    fingerprint,
    first_opened_at: firstOpenedAt,
    id,
    last_opened_at: lastOpenedAt,
    name,
    source_path: sourcePath,
  } = row

  if (
    typeof fingerprint !== "string" ||
    typeof firstOpenedAt !== "string" ||
    typeof id !== "string" ||
    typeof lastOpenedAt !== "string" ||
    typeof name !== "string" ||
    typeof sourcePath !== "string"
  ) {
    throw new Error("A persisted Document record is invalid.")
  }

  return {
    fingerprint,
    firstOpenedAt,
    id,
    lastOpenedAt,
    name,
    sourcePath,
  }
}
