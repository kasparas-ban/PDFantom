import os from "node:os"

import { z } from "zod"

import {
  GENERIC_CHAT_ERROR,
  type ChatModelInfo,
  type ChatModelListResult,
  type ChatRequest,
  type ChatStreamEvent,
} from "../../shared/chat-api"
import type { ChatThreadMessage } from "../../shared/chat-thread-api"
import type { CodexSessionStatus } from "../../shared/settings-api"
import type { SettingsStore } from "../settings-store"
import { CodexAppServer } from "./app-server"
import { planCodexTurn, type CodexThreadState } from "./conversation"
import { locateCodexExecutable, MINIMUM_CODEX_VERSION } from "./executable"
import { startCodexThread, streamCodexTurn } from "./turn"

const CHATGPT_MODEL_ID_PREFIX = "chatgpt/"

const REASONS = {
  missing: "Install the Codex CLI and run `codex login` to use ChatGPT models.",
  overrideMissing: (path: string) => `The Codex executable at ${path} could not be run.`,
  outdated: (version: string) =>
    `Update the Codex CLI to ${MINIMUM_CODEX_VERSION} or newer (found ${version}).`,
  signedOut: "Run `codex login` to use ChatGPT models.",
  unresponsive: "The Codex app-server could not be started.",
}

const authStatusSchema = z.object({ authMethod: z.string().nullable() })

const modelListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      displayName: z.string().min(1),
      supportedReasoningEfforts: z.array(z.object({ reasoningEffort: z.string() })),
      inputModalities: z.array(z.string()),
    }),
  ),
})

const configReadSchema = z.object({
  config: z.object({ mcp_servers: z.record(z.string(), z.unknown()).nullish() }),
})

type RunningServer = {
  executablePath: string
  server: CodexAppServer
  disabledMcpServers: Record<string, { enabled: false }>
}

type UnavailableStatus = Extract<CodexSessionStatus, { available: false }>

type Probe = { status: CodexSessionStatus; running: RunningServer | null }

export class CodexSession {
  private running: Promise<RunningServer> | null = null
  private readonly threads = new Map<string, CodexThreadState>()

  constructor(private readonly settings: SettingsStore) {}

  async status() {
    return (await this.probe()).status
  }

  async listModels(): Promise<ChatModelListResult> {
    const { status, running } = await this.probe()
    const listing =
      running &&
      modelListSchema.safeParse(
        await running.server
          .request("model/list", { includeHidden: false, limit: 100 })
          .catch(() => null),
      )
    if (!listing?.success) return { models: [], unavailableReason: unavailableReason(status) }

    const models: ChatModelInfo[] = listing.data.data.map((model) => {
      const efforts = model.supportedReasoningEfforts.map((option) => option.reasoningEffort)

      return {
        id: `${CHATGPT_MODEL_ID_PREFIX}${model.id}`,
        name: model.displayName,
        supportsReasoning: efforts.length > 0,
        effortLevels: efforts,
        supportsImages: model.inputModalities.includes("image"),
        outputModalities: ["text"],
      }
    })

    return status.available ? { models } : { models, unavailableReason: status.reason }
  }

  async *streamChat(
    request: ChatRequest,
    abortSignal: AbortSignal,
    parentMessages?: readonly ChatThreadMessage[],
  ) {
    const running = await this.acquire()
    if ("reason" in running) {
      yield { type: "error", message: running.reason } satisfies ChatStreamEvent
      return
    }

    const { server, disabledMcpServers } = running
    const plan = planCodexTurn(
      this.threads.get(request.conversationId),
      request.messages,
      parentMessages,
    )
    const codexModel = request.model.slice(CHATGPT_MODEL_ID_PREFIX.length)

    try {
      const threadId =
        plan.kind === "continue"
          ? plan.threadId
          : await startCodexThread(server, codexModel, disabledMcpServers)
      const outcome = yield* streamCodexTurn(
        server,
        { threadId, codexModel, effort: request.effort, input: plan.input },
        abortSignal,
      )

      if (outcome.status === "failed") {
        yield { type: "error", message: outcome.message } satisfies ChatStreamEvent
        return
      }

      this.threads.set(request.conversationId, {
        threadId,
        lastUserMessageId: request.messages.at(-1)!.id,
        messageCount: request.messages.length,
        ...(parentMessages && { parentMessageCount: parentMessages.length }),
      })

      if (outcome.status === "interrupted") return

      yield {
        type: "done",
        metadata: {
          source: "chatgpt",
          model: request.model,
          ...(outcome.usage && { usage: outcome.usage }),
        },
      } satisfies ChatStreamEvent
    } catch {
      if (abortSignal.aborted) return

      yield { type: "error", message: GENERIC_CHAT_ERROR } satisfies ChatStreamEvent
    }
  }

  forgetThread(conversationId: string) {
    this.threads.delete(conversationId)
  }

  dispose() {
    void this.running?.then(({ server }) => server.stop()).catch(() => {})
    this.running = null
  }

  private async acquire(): Promise<RunningServer | { reason: string }> {
    const current = await this.running?.catch(() => null)
    if (current) return current

    const { status, running } = await this.probe()
    return status.available && running ? running : { reason: unavailableReason(status) }
  }

  private async probe(): Promise<Probe> {
    const { codexExecutablePath } = await this.settings.read()
    const executable = await locateCodexExecutable({
      overridePath: codexExecutablePath ?? null,
      env: process.env,
      homeDirectory: os.homedir(),
    })

    if (executable.status === "missing") {
      const status: UnavailableStatus = executable.path
        ? {
            available: false,
            reason: REASONS.overrideMissing(executable.path),
            executablePath: executable.path,
          }
        : { available: false, reason: REASONS.missing }

      return { status, running: null }
    }

    const { path: executablePath, version } = executable
    if (executable.status === "outdated") {
      return {
        status: { available: false, reason: REASONS.outdated(version), executablePath, version },
        running: null,
      }
    }

    let running: RunningServer

    try {
      running = await this.ensureRunning(executablePath)
    } catch {
      return {
        status: { available: false, reason: REASONS.unresponsive, executablePath, version },
        running: null,
      }
    }

    const auth = authStatusSchema.safeParse(
      await running.server
        .request("getAuthStatus", { includeToken: false, refreshToken: false })
        .catch(() => null),
    )
    if (auth.success && auth.data.authMethod) {
      return { status: { available: true, executablePath, version }, running }
    }

    return {
      status: { available: false, reason: REASONS.signedOut, executablePath, version },
      running,
    }
  }

  private async ensureRunning(executablePath: string) {
    const current = await this.running?.catch(() => null)

    if (current && current.executablePath !== executablePath) {
      current.server.stop()
      this.running = null
    }

    this.running ??= this.start(executablePath).catch((error: unknown) => {
      this.running = null
      throw error
    })

    return this.running
  }

  private async start(executablePath: string): Promise<RunningServer> {
    const server = new CodexAppServer(executablePath)
    server.onExit(() => {
      this.running = null
      this.threads.clear()
    })

    await server.initialize()

    const config = configReadSchema.safeParse(
      await server.request("config/read", { includeLayers: false }).catch(() => null),
    )
    const mcpServerNames = Object.keys(config.success ? (config.data.config.mcp_servers ?? {}) : {})

    return {
      executablePath,
      server,
      disabledMcpServers: Object.fromEntries(
        mcpServerNames.map((name) => [name, { enabled: false as const }]),
      ),
    }
  }
}

function unavailableReason(status: CodexSessionStatus) {
  return status.available ? REASONS.unresponsive : status.reason
}
