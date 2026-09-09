import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron"
import { z } from "zod"

import { CHAT_MODEL_SOURCE_IDS } from "../shared/chat-api"
import {
  APPEND_CHAT_MESSAGE_CHANNEL,
  CREATE_CHAT_THREAD_CHANNEL,
  DELETE_CHAT_THREAD_CHANNEL,
  LIST_CHAT_THREADS_CHANNEL,
  LOAD_CHAT_THREAD_CHANNEL,
  MARK_CHAT_THREAD_VIEWED_CHANNEL,
} from "../shared/chat-thread-api"
import type { ChatThreadRepository } from "./chat-thread-repository"
import { isTrustedRenderer } from "./trusted-renderer"

const threadIdSchema = z.uuid()

const selectionSchema = z.object({
  model: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_./:-]+$/),
  source: z.enum(CHAT_MODEL_SOURCE_IDS),
  effort: z
    .string()
    .regex(/^[a-z]{1,20}$/)
    .optional(),
})

const usageSchema = z.object({
  inputTokens: z.number().nonnegative().optional(),
  outputTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
})

const pageNumberSchema = z.number().int().min(1)

const quoteSchema = z.object({
  text: z.string().min(1).max(200_000),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("message"), messageId: z.string().max(200) }),
    z
      .object({
        type: z.literal("document"),
        firstPage: pageNumberSchema,
        lastPage: pageNumberSchema,
      })
      .refine((source) => source.firstPage <= source.lastPage),
  ]),
})

const messageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(200_000),
  quotes: z.array(quoteSchema).min(1).max(50).optional(),
  status: z.union([
    z.object({ type: z.literal("complete") }),
    z.object({ type: z.literal("incomplete"), error: z.string().max(4_000).optional() }),
  ]),
  createdAt: z.iso.datetime(),
  generation: z
    .object({
      source: z.enum(CHAT_MODEL_SOURCE_IDS),
      model: z.string().min(1).max(200),
      usage: usageSchema.optional(),
    })
    .optional(),
})

const createSchema = z.object({
  id: threadIdSchema,
  documentId: z.string().min(1).max(200),
  message: messageSchema,
  selection: selectionSchema,
  parentThreadId: threadIdSchema.optional(),
})

const appendSchema = z.object({
  threadId: threadIdSchema,
  parentId: z.string().min(1).max(200).nullable(),
  message: messageSchema,
  selection: selectionSchema.optional(),
})

type ChatThreadBoundaryHooks = {
  readonly onDeleteThread: (threadId: string) => void
}

export function registerChatThreadBoundary(
  window: BrowserWindow,
  rendererUrl: string,
  repository: ChatThreadRepository,
  hooks: ChatThreadBoundaryHooks,
) {
  const trusted = (event: IpcMainInvokeEvent) => {
    if (!isTrustedRenderer(event, window, rendererUrl)) {
      throw new Error("Chat Thread access was denied for an untrusted sender.")
    }
  }

  ipcMain.handle(LIST_CHAT_THREADS_CHANNEL, async (event) => {
    trusted(event)
    return repository.listThreads()
  })

  ipcMain.handle(LOAD_CHAT_THREAD_CHANNEL, async (event, threadId: unknown) => {
    trusted(event)
    return repository.loadThread(threadIdSchema.parse(threadId))
  })

  ipcMain.handle(CREATE_CHAT_THREAD_CHANNEL, async (event, input: unknown) => {
    trusted(event)
    return repository.createThread(createSchema.parse(input))
  })

  ipcMain.handle(APPEND_CHAT_MESSAGE_CHANNEL, async (event, input: unknown) => {
    trusted(event)
    return repository.appendMessage(appendSchema.parse(input))
  })

  ipcMain.handle(DELETE_CHAT_THREAD_CHANNEL, async (event, threadId: unknown) => {
    trusted(event)
    const id = threadIdSchema.parse(threadId)

    for (const thread of repository.listThreads()) {
      if (thread.parentThreadId === id) hooks.onDeleteThread(thread.id)
    }

    hooks.onDeleteThread(id)
    repository.deleteThread(id)
  })

  ipcMain.handle(MARK_CHAT_THREAD_VIEWED_CHANNEL, async (event, threadId: unknown) => {
    trusted(event)
    return repository.markViewed(threadIdSchema.parse(threadId))
  })
}
