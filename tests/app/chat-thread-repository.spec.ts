import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

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
      message: message("u1", "user", "  Explain   the first chapter\nin detail", "2026-09-07T10:00:05.000Z"),
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
