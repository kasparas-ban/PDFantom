import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

import { expect, test } from "@playwright/test"

import { ChatThreadRepository } from "../../src/main/chat-thread-repository"
import { DocumentRepository } from "../../src/main/document-repository"
import { StudyHistoryDatabase } from "../../src/main/study-history-database"
import type { ChatThreadMessage } from "../../src/shared/chat-thread-api"

const THREAD_ID = "11111111-1111-4111-8111-111111111111"

async function withRepositories<T>(
  run: (repositories: {
    documents: DocumentRepository
    threads: ChatThreadRepository
    database: StudyHistoryDatabase
  }) => T | Promise<T>,
) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-chat-threads-"))
  const database = new StudyHistoryDatabase(path.join(workspace, "study-history.sqlite"))
  const clock = [
    "2026-09-07T10:00:00.000Z",
    "2026-09-07T10:00:01.000Z",
    "2026-09-07T10:00:02.000Z",
    "2026-09-07T10:00:03.000Z",
  ]
  const now = () => new Date(clock.shift() ?? "2026-09-07T10:00:09.000Z")

  try {
    return await run({
      database,
      documents: new DocumentRepository(database, { now }),
      threads: new ChatThreadRepository(database, { now }),
    })
  } finally {
    database.close()
    await rm(workspace, { force: true, recursive: true })
  }
}

const message = (
  id: string,
  role: ChatThreadMessage["role"],
  content: string,
  createdAt: string,
  extra: Partial<ChatThreadMessage> = {},
): ChatThreadMessage => ({
  id,
  role,
  content,
  status: { type: "complete" },
  createdAt,
  ...extra,
})

test("creates a Chat Thread with its first message and a derived title", async () => {
  await withRepositories(({ documents, threads }) => {
    const document = documents.recordOpenedDocument({
      fingerprint: "a".repeat(64),
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })

    const thread = threads.createThread({
      id: THREAD_ID,
      documentId: document.id,
      message: message(
        "u1",
        "user",
        "  Explain   the first chapter\nin detail",
        "2026-09-07T10:00:05.000Z",
      ),
      selection: { model: "openai/gpt-5.4-mini", source: "openrouter", effort: "high" },
    })

    expect(thread).toMatchObject({
      id: THREAD_ID,
      documentId: document.id,
      title: "Explain the first chapter",
      lastMessageAt: "2026-09-07T10:00:05.000Z",
      selection: { model: "openai/gpt-5.4-mini", source: "openrouter", effort: "high" },
    })
    expect(threads.loadThread(THREAD_ID)?.messages).toEqual([
      message("u1", "user", "  Explain   the first chapter\nin detail", "2026-09-07T10:00:05.000Z"),
    ])
  })
})

test("appending after a parent replaces what followed it and remembers the Model", async () => {
  await withRepositories(({ documents, threads }) => {
    const document = documents.recordOpenedDocument({
      fingerprint: "a".repeat(64),
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    threads.createThread({
      id: THREAD_ID,
      documentId: document.id,
      message: message("u1", "user", "Hello", "2026-09-07T10:00:05.000Z"),
      selection: { model: "openrouter/free", source: "openrouter", effort: "medium" },
    })
    threads.appendMessage({
      threadId: THREAD_ID,
      parentId: "u1",
      message: message("a1", "assistant", "First reply", "2026-09-07T10:00:06.000Z", {
        status: { type: "incomplete", error: "Insufficient credits" },
        generation: { source: "openrouter", model: "openrouter/free" },
      }),
    })

    const thread = threads.appendMessage({
      threadId: THREAD_ID,
      parentId: "u1",
      message: message("a2", "assistant", "Regenerated reply", "2026-09-07T10:00:07.000Z", {
        generation: {
          source: "chatgpt",
          model: "chatgpt/gpt-5.6",
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
        },
      }),
      selection: { model: "chatgpt/gpt-5.6", source: "chatgpt" },
    })

    expect(thread.lastMessageAt).toBe("2026-09-07T10:00:07.000Z")
    expect(thread.selection).toEqual({ model: "chatgpt/gpt-5.6", source: "chatgpt" })
    expect(threads.loadThread(THREAD_ID)?.messages.map((item) => item.id)).toEqual(["u1", "a2"])
    expect(threads.loadThread(THREAD_ID)?.messages[1]).toMatchObject({
      status: { type: "complete" },
      generation: {
        source: "chatgpt",
        model: "chatgpt/gpt-5.6",
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
      },
    })
  })
})

test("lists Chat Threads by activity, tracks viewing, and cascades deletion", async () => {
  await withRepositories(({ database, documents, threads }) => {
    const document = documents.recordOpenedDocument({
      fingerprint: "a".repeat(64),
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    const older = "22222222-2222-4222-8222-222222222222"
    threads.createThread({
      id: older,
      documentId: document.id,
      message: message("u1", "user", "Older", "2026-09-07T09:00:00.000Z"),
      selection: { model: "openrouter/free", source: "openrouter" },
    })
    threads.createThread({
      id: THREAD_ID,
      documentId: document.id,
      message: message("u2", "user", "Newer", "2026-09-07T10:00:00.000Z"),
      selection: { model: "openrouter/free", source: "openrouter" },
    })

    expect(threads.listThreads().map((thread) => thread.id)).toEqual([THREAD_ID, older])

    const viewed = threads.markViewed(older)
    expect(viewed?.lastViewedAt.localeCompare(threads.findThread(THREAD_ID)!.lastViewedAt)).toBe(1)

    threads.deleteThread(THREAD_ID)
    expect(threads.loadThread(THREAD_ID)).toBeNull()
    expect(
      database.connection.prepare("SELECT COUNT(*) AS count FROM chat_messages").get(),
    ).toEqual({ count: 1 })
  })
})

test("persists Quotes on user messages and titles a quote-only message from its Quote", async () => {
  await withRepositories(({ documents, threads }) => {
    const document = documents.recordOpenedDocument({
      fingerprint: "a".repeat(64),
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    const quotes: ChatThreadMessage["quotes"] = [
      { text: "keepalives at 20, 40, and 60", source: { type: "message", messageId: "a0" } },
      { text: "close the socket", source: { type: "message", messageId: "a0" } },
      {
        text: "Energy enters most ecosystems",
        source: { type: "document", firstPage: 3, lastPage: 3 },
      },
      { text: "Matter is reused", source: { type: "document", firstPage: 3, lastPage: 4 } },
    ]

    const thread = threads.createThread({
      id: THREAD_ID,
      documentId: document.id,
      message: message("u1", "user", "", "2026-09-07T10:00:05.000Z", { quotes }),
      selection: { model: "openrouter/free", source: "openrouter" },
    })
    threads.appendMessage({
      threadId: THREAD_ID,
      parentId: "u1",
      message: message("a1", "assistant", "Because.", "2026-09-07T10:00:06.000Z"),
    })

    expect(thread.title).toBe("keepalives at 20, 40, and 60")
    expect(threads.loadThread(THREAD_ID)?.messages).toEqual([
      message("u1", "user", "", "2026-09-07T10:00:05.000Z", { quotes }),
      message("a1", "assistant", "Because.", "2026-09-07T10:00:06.000Z"),
    ])
  })
})

test("drops persisted Quotes without a valid source", async () => {
  await withRepositories(({ database, documents, threads }) => {
    const document = documents.recordOpenedDocument({
      fingerprint: "a".repeat(64),
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    threads.createThread({
      id: THREAD_ID,
      documentId: document.id,
      message: message("u1", "user", "Why?", "2026-09-07T10:00:05.000Z", {
        quotes: [{ text: "kept", source: { type: "document", firstPage: 1, lastPage: 1 } }],
      }),
      selection: { model: "openrouter/free", source: "openrouter" },
    })
    database.connection.prepare("UPDATE chat_messages SET quotes_json = ? WHERE id = ?").run(
      JSON.stringify([
        { text: "legacy", messageId: "a0" },
        { text: "backwards", source: { type: "document", firstPage: 2, lastPage: 1 } },
        { text: "kept", source: { type: "document", firstPage: 1, lastPage: 1 } },
      ]),
      "u1",
    )

    expect(threads.loadThread(THREAD_ID)?.messages[0]?.quotes).toEqual([
      { text: "kept", source: { type: "document", firstPage: 1, lastPage: 1 } },
    ])
  })
})

test("a Side Chat copies its parent's Document, never nests, and dies with its parent", async () => {
  await withRepositories(({ database, documents, threads }) => {
    const document = documents.recordOpenedDocument({
      fingerprint: "a".repeat(64),
      name: "notes.pdf",
      sourcePath: "/documents/notes.pdf",
    })
    const sideChatId = "33333333-3333-4333-8333-333333333333"
    threads.createThread({
      id: THREAD_ID,
      documentId: document.id,
      message: message("u1", "user", "Main question", "2026-09-07T10:00:00.000Z"),
      selection: { model: "openrouter/free", source: "openrouter" },
    })

    const sideChat = threads.createThread({
      id: sideChatId,
      documentId: "ignored-document",
      parentThreadId: THREAD_ID,
      message: message("s1", "user", "Side question", "2026-09-07T10:01:00.000Z"),
      selection: { model: "openrouter/free", source: "openrouter" },
    })

    expect(sideChat).toMatchObject({ documentId: document.id, parentThreadId: THREAD_ID })
    expect(threads.listThreads().map(({ id, parentThreadId }) => ({ id, parentThreadId }))).toEqual(
      [
        { id: sideChatId, parentThreadId: THREAD_ID },
        { id: THREAD_ID, parentThreadId: null },
      ],
    )
    expect(() =>
      threads.createThread({
        id: "44444444-4444-4444-8444-444444444444",
        documentId: document.id,
        parentThreadId: sideChatId,
        message: message("n1", "user", "Nested", "2026-09-07T10:02:00.000Z"),
        selection: { model: "openrouter/free", source: "openrouter" },
      }),
    ).toThrow("A Side Chat cannot own another Side Chat.")

    threads.deleteThread(THREAD_ID)
    expect(threads.listThreads()).toEqual([])
    expect(
      database.connection.prepare("SELECT COUNT(*) AS count FROM chat_messages").get(),
    ).toEqual({ count: 0 })
  })
})

test("adds the quotes column to a database created before Quotes existed", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-chat-threads-"))
  const databasePath = path.join(workspace, "study-history.sqlite")

  try {
    const legacy = new DatabaseSync(databasePath)
    legacy.exec(`
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        model TEXT,
        model_source TEXT,
        usage_json TEXT,
        created_at TEXT NOT NULL
      );
    `)
    legacy.close()

    const database = new StudyHistoryDatabase(databasePath)
    const columns = database.connection
      .prepare(`SELECT name FROM pragma_table_info('chat_messages')`)
      .all()
      .map((row) => row.name)
    database.close()

    expect(columns).toContain("quotes_json")
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})
