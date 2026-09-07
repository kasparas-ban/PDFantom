import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { z } from "zod"

export type FakeCodexOptions = {
  readonly version?: string
  readonly authMethod?: string | null
  readonly replies?: readonly string[]
  readonly models?: readonly { id: string; displayName: string; hidden?: boolean }[]
  readonly failingInput?: string
}

const requestSchema = z.object({ method: z.string(), params: z.record(z.string(), z.unknown()) })

const APP_SERVER_SCRIPT = path.resolve("tests/fixtures/fake-codex/app-server.mjs")

const DEFAULT_MODELS = [
  { id: "gpt-5.6-sol", displayName: "GPT-5.6-Sol" },
  { id: "gpt-5.4-mini", displayName: "GPT-5.4-Mini" },
  { id: "codex-auto-review", displayName: "Codex Auto Review", hidden: true },
]

export async function installFakeCodex(workspace: string, options: FakeCodexOptions) {
  const binDirectory = path.join(workspace, "fake-codex")
  const configPath = path.join(binDirectory, "config.json")
  const executablePath = path.join(binDirectory, "codex")
  const config = {
    version: options.version ?? "0.152.0",
    authMethod: options.authMethod === undefined ? "chatgpt" : options.authMethod,
    replies: options.replies ?? ["Hello from Codex"],
    models: (options.models ?? DEFAULT_MODELS).map((model) =>
      Object.assign({ hidden: false }, model),
    ),
    failingInput: options.failingInput ?? null,
    requestLogPath: requestLog(workspace),
  }

  await mkdir(binDirectory, { recursive: true })
  await writeFile(configPath, JSON.stringify(config))
  await writeFile(
    executablePath,
    `#!/bin/sh\nFAKE_CODEX_CONFIG="${configPath}" exec "${process.execPath}" "${APP_SERVER_SCRIPT}" "$@"\n`,
  )
  await chmod(executablePath, 0o755)

  return executablePath
}

export async function readFakeCodexRequests(workspace: string) {
  const contents = await readFile(requestLog(workspace), "utf8").catch(() => "")

  return contents
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => requestSchema.parse(JSON.parse(line)))
}

function requestLog(workspace: string) {
  return path.join(workspace, "codex-requests.jsonl")
}
