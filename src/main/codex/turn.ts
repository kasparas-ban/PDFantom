import { z } from "zod"

import { GENERIC_CHAT_ERROR, type ChatStreamEvent, type ChatUsage } from "../../shared/chat-api"
import type { CodexAppServer } from "./app-server"
import { codexTurnErrorMessage } from "./conversation"

const BASE_INSTRUCTIONS = `You are the reading assistant inside PDFantom, a desktop PDF reader. A user reads a document and discusses it with you. Answer their questions directly and accurately, and say so when you are unsure. Format replies in Markdown. You have no tools and cannot run commands or edit files.`

const DISABLED_FEATURES = [
  "apps",
  "browser_use",
  "computer_use",
  "goals",
  "hooks",
  "image_generation",
  "memories",
  "multi_agent",
  "plugins",
  "shell_snapshot",
  "shell_tool",
  "skill_search",
  "sleep_tool",
  "tool_suggest",
  "view_image",
]

const threadStartSchema = z.object({ thread: z.object({ id: z.string() }) })

const turnStartSchema = z.object({ turn: z.object({ id: z.string() }) })

const turnScopeSchema = z.object({ threadId: z.string(), turnId: z.string() })

const agentMessageDeltaSchema = turnScopeSchema.extend({ delta: z.string() })

const turnCompletedSchema = z.object({
  threadId: z.string(),
  turn: z.object({
    id: z.string(),
    status: z.enum(["completed", "interrupted", "failed", "inProgress"]),
    error: z.unknown().nullable(),
  }),
})

const tokenUsageSchema = turnScopeSchema.extend({
  tokenUsage: z.object({
    last: z.object({
      totalTokens: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
    }),
  }),
})

export type CodexTurnParams = {
  readonly threadId: string
  readonly codexModel: string
  readonly effort?: string
  readonly input: string
}

export type CodexTurnOutcome =
  | { status: "completed"; usage?: ChatUsage }
  | { status: "interrupted" }
  | { status: "failed"; message: string }

export async function startCodexThread(
  server: CodexAppServer,
  codexModel: string,
  disabledMcpServers: Record<string, { enabled: false }>,
) {
  const started = threadStartSchema.parse(
    await server.request("thread/start", {
      ephemeral: true,
      baseInstructions: BASE_INSTRUCTIONS,
      model: codexModel,
      approvalPolicy: "never",
      sandbox: "read-only",
      cwd: "/",
      config: {
        notify: [],
        web_search: "disabled",
        project_doc_max_bytes: 0,
        features: Object.fromEntries(DISABLED_FEATURES.map((feature) => [feature, false])),
        mcp_servers: disabledMcpServers,
      },
    }),
  )

  return started.thread.id
}

export async function* streamCodexTurn(
  server: CodexAppServer,
  { threadId, codexModel, effort, input }: CodexTurnParams,
  abortSignal: AbortSignal,
): AsyncGenerator<ChatStreamEvent, CodexTurnOutcome> {
  const notifications = server.notifications()

  try {
    const { turn } = turnStartSchema.parse(
      await server.request("turn/start", {
        threadId,
        input: [{ type: "text", text: input, text_elements: [] }],
        model: codexModel,
        ...(effort && { effort }),
      }),
    )
    const isCurrentTurn = (scope: { threadId: string; turnId: string }) =>
      scope.threadId === threadId && scope.turnId === turn.id

    abortSignal.addEventListener(
      "abort",
      () => void server.request("turn/interrupt", { threadId, turnId: turn.id }).catch(() => {}),
      { once: true },
    )

    let usage: ChatUsage | undefined
    let receivedText = false

    for await (const notification of notifications) {
      switch (notification.method) {
        case "item/agentMessage/delta": {
          const delta = agentMessageDeltaSchema.parse(notification.params)
          if (!isCurrentTurn(delta) || !delta.delta) break

          receivedText = true
          yield { type: "delta", text: delta.delta }
          break
        }
        case "thread/tokenUsage/updated": {
          const update = tokenUsageSchema.parse(notification.params)
          if (isCurrentTurn(update)) usage = update.tokenUsage.last
          break
        }
        case "turn/completed": {
          const completed = turnCompletedSchema.parse(notification.params)
          if (!isCurrentTurn({ threadId: completed.threadId, turnId: completed.turn.id })) break

          switch (completed.turn.status) {
            case "failed":
              return { status: "failed", message: codexTurnErrorMessage(completed.turn.error) }
            case "interrupted":
              return { status: "interrupted" }
            case "completed":
              if (!receivedText) throw new Error(GENERIC_CHAT_ERROR)

              return { status: "completed", ...(usage && { usage }) }
            case "inProgress":
              break
          }
        }
      }
    }

    throw new Error(GENERIC_CHAT_ERROR)
  } finally {
    notifications.close()
  }
}
