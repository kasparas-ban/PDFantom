import { appendFileSync, readFileSync } from "node:fs"
import { createInterface } from "node:readline"

const config = JSON.parse(readFileSync(process.env.FAKE_CODEX_CONFIG, "utf8"))
const [command] = process.argv.slice(2)

if (command === "--version") {
  process.stdout.write(`codex-cli ${config.version}\n`)
  process.exit(0)
}

if (command !== "app-server") {
  process.stderr.write(`unsupported command: ${process.argv.slice(2).join(" ")}\n`)
  process.exit(2)
}

let sequence = 0
let turnCount = 0
let activeTurn = null

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)
const nextId = (prefix) => `${prefix}-${++sequence}`
const usage = (reply) => ({
  totalTokens: 100 + reply.length,
  inputTokens: 100,
  cachedInputTokens: 0,
  cacheWriteInputTokens: 0,
  outputTokens: reply.length,
  reasoningOutputTokens: 0,
})

const handlers = {
  initialize: () => ({
    userAgent: "fake-codex",
    codexHome: "/tmp",
    platformFamily: "unix",
    platformOs: "macos",
  }),
  getAuthStatus: () => ({
    authMethod: config.authMethod,
    authToken: null,
    requiresOpenaiAuth: true,
  }),
  "config/read": () => ({
    config: {
      mcp_servers: { playwright: { command: "npx" }, docs: { url: "https://example.test" } },
    },
    origins: {},
    layers: null,
  }),
  "model/list": (params) => ({
    data: config.models
      .filter((model) => params.includeHidden || !model.hidden)
      .map((model) => ({
        id: model.id,
        model: model.id,
        displayName: model.displayName,
        hidden: model.hidden,
        supportedReasoningEfforts: ["low", "medium", "high", "xhigh"].map((effort) => ({
          reasoningEffort: effort,
          description: effort,
        })),
        defaultReasoningEffort: "medium",
        inputModalities: ["text", "image"],
        isDefault: false,
      })),
    nextCursor: null,
  }),
  "thread/start": (params) => ({
    thread: { id: nextId("thread"), ephemeral: Boolean(params.ephemeral) },
    model: params.model,
    reasoningEffort: null,
  }),
  "turn/start": (params) => {
    const turnId = nextId("turn")
    const input = params.input.map((item) => item.text ?? "").join("")
    activeTurn = { threadId: params.threadId, turnId, cancelled: false }
    queueMicrotask(() => runTurn(activeTurn, input))
    return { turn: { id: turnId, items: [], status: "inProgress", error: null } }
  },
  "turn/interrupt": (params) => {
    if (activeTurn && activeTurn.turnId === params.turnId) activeTurn.cancelled = true
    return {}
  },
}

function completeTurn(turn, status, error = null) {
  send({
    method: "turn/completed",
    params: { threadId: turn.threadId, turn: { id: turn.turnId, items: [], status, error } },
  })
}

function runTurn(turn, input) {
  const scope = { threadId: turn.threadId, turnId: turn.turnId }

  if (config.failingInput && input.includes(config.failingInput)) {
    const error = {
      message: JSON.stringify({
        type: "error",
        status: 400,
        error: {
          type: "invalid_request_error",
          message: "This model is not available on your plan.",
        },
      }),
      codexErrorInfo: "other",
      additionalDetails: null,
      misalignment: null,
    }
    send({ method: "error", params: { ...scope, error, willRetry: false } })
    completeTurn(turn, "failed", error)
    return
  }

  const reply = config.replies[turnCount++ % config.replies.length]
  const words = reply.split(" ")
  const itemId = nextId("msg")
  let index = 0

  const tick = () => {
    if (turn.cancelled) {
      completeTurn(turn, "interrupted")
      return
    }

    if (index < words.length) {
      const delta = (index === 0 ? "" : " ") + words[index++]
      send({ method: "item/agentMessage/delta", params: { ...scope, itemId, delta } })
      setTimeout(tick, 40)
      return
    }

    send({
      method: "thread/tokenUsage/updated",
      params: {
        ...scope,
        tokenUsage: { total: usage(reply), last: usage(reply), modelContextWindow: 258400 },
      },
    })
    completeTurn(turn, "completed")
  }

  tick()
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line)
  if (message.id === undefined) return

  appendFileSync(
    config.requestLogPath,
    `${JSON.stringify({ method: message.method, params: message.params })}\n`,
  )
  const handler = handlers[message.method]

  if (!handler) {
    send({ id: message.id, error: { code: -32601, message: `Unknown method ${message.method}` } })
    return
  }

  send({ id: message.id, result: handler(message.params ?? {}) })
})

process.stdin.on("end", () => process.exit(0))
