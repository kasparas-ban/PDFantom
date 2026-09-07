import type { DatabaseSync as Database, SQLOutputValue } from "node:sqlite"

import { CHAT_MODEL_SOURCE_IDS, type ChatModelSourceId } from "../shared/chat-api"
import {
  deriveChatThreadTitle,
  type AppendChatMessageInput,
  type ChatThreadMessage,
  type ChatThreadSelection,
  type ChatThreadSummary,
  type CreateChatThreadInput,
  type LoadedChatThread,
} from "../shared/chat-thread-api"
import type { StudyHistoryDatabase } from "./study-history-database"

type ChatThreadRepositoryDependencies = {
  readonly now?: () => Date
}

const THREAD_COLUMNS = `
  id,
  document_id,
  title,
  model,
  model_source,
  effort,
  created_at,
  last_message_at,
  last_viewed_at
`

const MESSAGE_COLUMNS = `
  id,
  role,
  content,
  status,
  error,
  model,
  model_source,
  usage_json,
  created_at
`

export class ChatThreadRepository {
  private readonly database: Database
  private readonly now: () => Date

  constructor(
    private readonly studyHistory: StudyHistoryDatabase,
    dependencies: ChatThreadRepositoryDependencies = {},
  ) {
    this.database = studyHistory.connection
    this.now = dependencies.now ?? (() => new Date())
  }

  listThreads() {
    return this.database
      .prepare(
        `SELECT ${THREAD_COLUMNS}
         FROM chat_threads
         ORDER BY last_message_at DESC, created_at DESC`,
      )
      .all()
      .map(mapThread)
  }

  findThread(threadId: string) {
    const row = this.database
      .prepare(`SELECT ${THREAD_COLUMNS} FROM chat_threads WHERE id = ?`)
      .get(threadId)

    return row ? mapThread(row) : null
  }

  loadThread(threadId: string): LoadedChatThread | null {
    const thread = this.findThread(threadId)
    if (!thread) return null

    const messages = this.database
      .prepare(
        `SELECT ${MESSAGE_COLUMNS}
         FROM chat_messages
         WHERE thread_id = ?
         ORDER BY ordinal ASC`,
      )
      .all(threadId)
      .map(mapMessage)

    return { thread, messages }
  }

  createThread({ id, documentId, message, selection }: CreateChatThreadInput) {
    return this.studyHistory.inTransaction(() => {
      const now = this.now().toISOString()

      this.database
        .prepare(
          `INSERT INTO chat_threads (
             id, document_id, title, model, model_source, effort,
             created_at, last_message_at, last_viewed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          documentId,
          deriveChatThreadTitle(message.content),
          selection.model,
          selection.source,
          selection.effort ?? null,
          now,
          message.createdAt,
          now,
        )
      this.insertMessage(id, 0, message)

      return this.requireThread(id)
    })
  }

  appendMessage({ threadId, parentId, message, selection }: AppendChatMessageInput) {
    return this.studyHistory.inTransaction(() => {
      this.requireThread(threadId)

      const ordinal = parentId === null ? 0 : this.ordinalOf(threadId, parentId) + 1

      this.database
        .prepare(`DELETE FROM chat_messages WHERE thread_id = ? AND ordinal >= ?`)
        .run(threadId, ordinal)
      this.insertMessage(threadId, ordinal, message)
      this.database
        .prepare(
          `UPDATE chat_threads
           SET last_message_at = ?,
               model = COALESCE(?, model),
               model_source = COALESCE(?, model_source),
               effort = CASE WHEN ? IS NULL THEN effort ELSE ? END
           WHERE id = ?`,
        )
        .run(
          message.createdAt,
          selection?.model ?? null,
          selection?.source ?? null,
          selection?.model ?? null,
          selection?.effort ?? null,
          threadId,
        )

      return this.requireThread(threadId)
    })
  }

  markViewed(threadId: string) {
    this.database
      .prepare(`UPDATE chat_threads SET last_viewed_at = ? WHERE id = ?`)
      .run(this.now().toISOString(), threadId)

    return this.findThread(threadId)
  }

  deleteThread(threadId: string) {
    this.database.prepare(`DELETE FROM chat_threads WHERE id = ?`).run(threadId)
  }

  private insertMessage(threadId: string, ordinal: number, message: ChatThreadMessage) {
    this.database
      .prepare(
        `INSERT INTO chat_messages (
           id, thread_id, ordinal, role, content, status, error,
           model, model_source, usage_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        threadId,
        ordinal,
        message.role,
        message.content,
        message.status.type,
        message.status.type === "incomplete" ? (message.status.error ?? null) : null,
        message.generation?.model ?? null,
        message.generation?.source ?? null,
        message.generation?.usage ? JSON.stringify(message.generation.usage) : null,
        message.createdAt,
      )
  }

  private ordinalOf(threadId: string, messageId: string) {
    const row = this.database
      .prepare(`SELECT ordinal FROM chat_messages WHERE thread_id = ? AND id = ?`)
      .get(threadId, messageId)
    if (!row || typeof row.ordinal !== "number") {
      throw new Error("The parent message does not belong to this Chat Thread.")
    }

    return row.ordinal
  }

  private requireThread(threadId: string) {
    const thread = this.findThread(threadId)
    if (!thread) throw new Error("The requested Chat Thread does not exist.")

    return thread
  }
}

function mapThread(row: Record<string, SQLOutputValue>): ChatThreadSummary {
  const {
    id,
    document_id: documentId,
    title,
    model,
    model_source: source,
    effort,
    created_at: createdAt,
    last_message_at: lastMessageAt,
    last_viewed_at: lastViewedAt,
  } = row

  if (
    typeof id !== "string" ||
    typeof documentId !== "string" ||
    typeof title !== "string" ||
    typeof createdAt !== "string" ||
    typeof lastMessageAt !== "string" ||
    typeof lastViewedAt !== "string"
  ) {
    throw new Error("A persisted Chat Thread record is invalid.")
  }

  return {
    id,
    documentId,
    title,
    createdAt,
    lastMessageAt,
    lastViewedAt,
    selection: mapSelection(model, source, effort),
  }
}

function mapSelection(
  model: SQLOutputValue,
  source: SQLOutputValue,
  effort: SQLOutputValue,
): ChatThreadSelection | null {
  if (typeof model !== "string" || !isModelSource(source)) return null

  return { model, source, ...(typeof effort === "string" && { effort }) }
}

function isModelSource(value: SQLOutputValue): value is ChatModelSourceId {
  return typeof value === "string" && (CHAT_MODEL_SOURCE_IDS as readonly string[]).includes(value)
}

function mapMessage(row: Record<string, SQLOutputValue>): ChatThreadMessage {
  const {
    id,
    role,
    content,
    status,
    error,
    model,
    model_source: source,
    usage_json: usageJson,
    created_at: createdAt,
  } = row

  if (
    typeof id !== "string" ||
    (role !== "user" && role !== "assistant") ||
    typeof content !== "string" ||
    (status !== "complete" && status !== "incomplete") ||
    typeof createdAt !== "string"
  ) {
    throw new Error("A persisted Chat Thread message is invalid.")
  }

  const generation =
    typeof model === "string" && isModelSource(source)
      ? { model, source, ...(typeof usageJson === "string" && { usage: parseUsage(usageJson) }) }
      : undefined

  return {
    id,
    role,
    content,
    createdAt,
    status:
      status === "complete"
        ? { type: "complete" }
        : { type: "incomplete", ...(typeof error === "string" && { error }) },
    ...(generation && { generation }),
  }
}

function parseUsage(json: string) {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== "object" || parsed === null) return undefined

    const { inputTokens, outputTokens, totalTokens } = parsed as {
      inputTokens?: unknown
      outputTokens?: unknown
      totalTokens?: unknown
    }

    return {
      ...(typeof inputTokens === "number" && { inputTokens }),
      ...(typeof outputTokens === "number" && { outputTokens }),
      ...(typeof totalTokens === "number" && { totalTokens }),
    }
  } catch {
    return undefined
  }
}
