import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface } from "node:readline"

import { z } from "zod"

const CLIENT_INFO = { name: "pdfantom", title: "PDFantom", version: "0.1.0" }

const messageSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
})

const errorMessageSchema = z.object({ message: z.string() })

export type CodexNotification = { method: string; params: unknown }

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

export class CodexAppServer {
  private readonly pending = new Map<number, PendingRequest>()
  private readonly notificationListeners = new Set<(notification: CodexNotification) => void>()
  private readonly exitListeners = new Set<() => void>()
  private nextRequestId = 1
  private exited = false
  private readonly process: ChildProcessWithoutNullStreams

  constructor(executablePath: string) {
    this.process = spawn(executablePath, ["app-server"], {
      cwd: "/",
      stdio: "pipe",
      windowsHide: true,
    })
    this.process.stderr.resume()
    this.process.on("error", () => this.handleExit())
    this.process.on("exit", () => this.handleExit())
    this.process.stdin.on("error", () => undefined)
    createInterface({ input: this.process.stdout }).on("line", (line) => this.handleLine(line))
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: CLIENT_INFO,
      capabilities: { experimentalApi: false, requestAttestation: false },
    })
    this.send({ method: "initialized", params: {} })
  }

  request(method: string, params: unknown): Promise<unknown> {
    if (this.exited) return Promise.reject(new Error("The Codex app-server is not running."))

    const id = this.nextRequestId++

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.send({ id, method, params })
    })
  }

  notifications() {
    return new NotificationStream(this)
  }

  onNotification(listener: (notification: CodexNotification) => void) {
    this.notificationListeners.add(listener)

    return () => {
      this.notificationListeners.delete(listener)
    }
  }

  onExit(listener: () => void) {
    this.exitListeners.add(listener)

    return () => {
      this.exitListeners.delete(listener)
    }
  }

  stop() {
    if (this.exited) return

    this.process.kill()
  }

  private send(message: object) {
    this.process.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private handleLine(line: string) {
    const message = messageSchema.safeParse(parseJson(line))
    if (!message.success) return

    const { id, method, params, result, error } = message.data

    if (method !== undefined) {
      if (id === undefined) {
        for (const listener of this.notificationListeners) listener({ method, params })
      } else {
        this.send({
          id,
          error: { code: -32601, message: "PDFantom does not handle server requests." },
        })
      }

      return
    }

    if (typeof id !== "number") return

    const pending = this.pending.get(id)
    if (!pending) return

    this.pending.delete(id)

    if (error === undefined) {
      pending.resolve(result)
      return
    }

    const details = errorMessageSchema.safeParse(error)
    pending.reject(
      new Error(details.success ? details.data.message : "Codex rejected the request."),
    )
  }

  private handleExit() {
    if (this.exited) return

    this.exited = true

    for (const { reject } of this.pending.values()) {
      reject(new Error("The Codex app-server exited."))
    }

    this.pending.clear()

    for (const listener of this.exitListeners) listener()

    this.exitListeners.clear()
    this.notificationListeners.clear()
  }
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

class NotificationStream implements AsyncIterable<CodexNotification> {
  private readonly buffered: CodexNotification[] = []
  private wake: (() => void) | null = null
  private closed = false
  private readonly unsubscribe: () => void
  private readonly unsubscribeExit: () => void

  constructor(server: CodexAppServer) {
    this.unsubscribe = server.onNotification((notification) => {
      this.buffered.push(notification)
      this.wake?.()
    })
    this.unsubscribeExit = server.onExit(() => this.close())
  }

  close() {
    this.closed = true
    this.unsubscribe()
    this.unsubscribeExit()
    this.wake?.()
  }

  [Symbol.asyncIterator](): AsyncIterator<CodexNotification> {
    return { next: () => this.next() }
  }

  private async next(): Promise<IteratorResult<CodexNotification>> {
    const buffered = this.buffered.shift()
    if (buffered) return { value: buffered, done: false }
    if (this.closed) return { value: undefined, done: true }

    await new Promise<void>((resolve) => {
      this.wake = resolve
    })
    this.wake = null

    return this.next()
  }
}
