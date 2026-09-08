import type { DatabaseSync as Database } from "node:sqlite"

const { DatabaseSync } = process.getBuiltinModule("node:sqlite")

export class StudyHistoryDatabase {
  readonly connection: Database

  constructor(databasePath: string) {
    this.connection = new DatabaseSync(databasePath)

    try {
      this.initializeSchema()
    } catch (error) {
      this.connection.close()
      throw error
    }
  }

  close() {
    this.connection.close()
  }

  inTransaction<T>(operation: () => T) {
    this.connection.exec("BEGIN IMMEDIATE")

    try {
      const result = operation()
      this.connection.exec("COMMIT")
      return result
    } catch (error) {
      this.connection.exec("ROLLBACK")
      throw error
    }
  }

  private initializeSchema() {
    this.connection.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        source_path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        first_opened_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_threads (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        model TEXT,
        model_source TEXT,
        effort TEXT,
        created_at TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        last_viewed_at TEXT NOT NULL,
        parent_thread_id TEXT REFERENCES chat_threads(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS chat_threads_by_document
        ON chat_threads (document_id, last_message_at DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('complete', 'incomplete')),
        error TEXT,
        model TEXT,
        model_source TEXT,
        usage_json TEXT,
        quotes_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (thread_id, ordinal)
      );
    `)

    this.ensureColumn("chat_messages", "quotes_json", "TEXT")
    this.ensureColumn(
      "chat_threads",
      "parent_thread_id",
      "TEXT REFERENCES chat_threads(id) ON DELETE CASCADE",
    )
    this.connection.exec(
      "CREATE INDEX IF NOT EXISTS chat_threads_by_parent ON chat_threads (parent_thread_id)",
    )
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const columns = this.connection
      .prepare(`SELECT name FROM pragma_table_info(?)`)
      .all(table)
      .map((row) => row.name)
    if (!columns.includes(column)) {
      this.connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }
}
