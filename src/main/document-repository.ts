import { randomUUID } from "node:crypto"
import type { DatabaseSync as Database, SQLOutputValue } from "node:sqlite"

const { DatabaseSync } = process.getBuiltinModule("node:sqlite")

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

  constructor(databasePath: string, dependencies: DocumentRepositoryDependencies = {}) {
    this.createId = dependencies.createId ?? randomUUID
    this.database = new DatabaseSync(databasePath)
    this.now = dependencies.now ?? (() => new Date())
    try {
      this.initializeSchema()
    } catch (error) {
      this.database.close()
      throw error
    }
  }

  close() {
    this.database.close()
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

    return this.inTransaction(() => {
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

      this.setActiveDocumentId(document.id)
      return document
    })
  }

  private findBySourcePath(sourcePath: string) {
    const row = this.database
      .prepare(`SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE source_path = ?`)
      .get(sourcePath)

    return row ? mapDocument(row) : null
  }

  private initializeSchema() {
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `)

    const row = this.database.prepare("PRAGMA user_version").get()
    const version = row?.user_version
    if (typeof version !== "number") {
      throw new Error("The Document library schema version is invalid.")
    }

    if (version === 0) {
      this.createInitialSchema()
      return
    }

    if (version === 1) {
      this.migrateFromFingerprintIdentity()
      return
    }

    if (version !== 2) {
      throw new Error(`Unsupported Document library schema version: ${version}.`)
    }
  }

  private createInitialSchema() {
    this.inTransaction(() => {
      this.database.exec(`
        CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          fingerprint TEXT NOT NULL,
          source_path TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          first_opened_at TEXT NOT NULL,
          last_opened_at TEXT NOT NULL
        );

        CREATE TABLE application_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        PRAGMA user_version = 2;
      `)
    })
  }

  private migrateFromFingerprintIdentity() {
    this.inTransaction(() => {
      this.database.exec(`
        ALTER TABLE documents RENAME TO fingerprint_identified_documents;

        CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          fingerprint TEXT NOT NULL,
          source_path TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          first_opened_at TEXT NOT NULL,
          last_opened_at TEXT NOT NULL
        );

        WITH ranked_documents AS (
          SELECT
            id,
            fingerprint,
            source_path,
            name,
            MIN(first_opened_at) OVER (PARTITION BY source_path) AS first_opened_at,
            last_opened_at,
            ROW_NUMBER() OVER (
              PARTITION BY source_path
              ORDER BY last_opened_at DESC, id DESC
            ) AS recency
          FROM fingerprint_identified_documents
        )
        INSERT INTO documents (
          id, fingerprint, source_path, name, first_opened_at, last_opened_at
        )
        SELECT id, fingerprint, source_path, name, first_opened_at, last_opened_at
        FROM ranked_documents
        WHERE recency = 1;

        UPDATE application_state AS state
        SET value = (
          SELECT current_document.id
          FROM fingerprint_identified_documents AS previous_document
          JOIN documents AS current_document
            ON current_document.source_path = previous_document.source_path
          WHERE previous_document.id = state.value
        )
        WHERE key = 'active_document_id'
          AND EXISTS (
            SELECT 1
            FROM fingerprint_identified_documents
            WHERE id = state.value
          );

        DROP TABLE fingerprint_identified_documents;
        PRAGMA user_version = 2;
      `)
    })
  }

  private inTransaction<T>(operation: () => T) {
    this.database.exec("BEGIN IMMEDIATE")

    try {
      const result = operation()
      this.database.exec("COMMIT")
      return result
    } catch (error) {
      this.database.exec("ROLLBACK")
      throw error
    }
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
