import { execFile } from "node:child_process"
import { access, constants } from "node:fs/promises"
import path from "node:path"

export const MINIMUM_CODEX_VERSION = "0.152.0"

const VERSION_PROBE_TIMEOUT_MS = 10_000

export type CodexExecutable =
  | { status: "ready"; path: string; version: string }
  | { status: "outdated"; path: string; version: string }
  | { status: "missing"; path?: string }

type LocateOptions = {
  readonly overridePath: string | null
  readonly env: NodeJS.ProcessEnv
  readonly homeDirectory: string
}

export function codexExecutableCandidates({
  overridePath,
  env,
  homeDirectory,
}: LocateOptions): string[] {
  if (overridePath) return [overridePath]

  const codexHome = env.CODEX_HOME || path.join(homeDirectory, ".codex")
  const searchPath = (env.PATH ?? "").split(path.delimiter).filter((entry) => entry.length > 0)

  return [
    ...new Set([
      path.join(codexHome, "packages", "standalone", "current", "bin", "codex"),
      path.join(homeDirectory, ".local", "bin", "codex"),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
      ...searchPath.map((directory) => path.join(directory, "codex")),
    ]),
  ]
}

export function parseCodexVersion(output: string) {
  return /(\d+)\.(\d+)\.(\d+)/.exec(output)?.[0] ?? null
}

export function isSupportedCodexVersion(version: string) {
  const actual = version.split(".").map(Number)
  const minimum = MINIMUM_CODEX_VERSION.split(".").map(Number)

  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index]
  }

  return true
}

export async function locateCodexExecutable(options: LocateOptions): Promise<CodexExecutable> {
  const found = await probeCandidates(codexExecutableCandidates(options))
  if (found) return found

  return options.overridePath
    ? { status: "missing", path: options.overridePath }
    : { status: "missing" }
}

async function probeCandidates(
  candidates: readonly string[],
): Promise<Extract<CodexExecutable, { version: string }> | null> {
  const [candidate, ...rest] = candidates
  if (!candidate) return null

  const version = (await isExecutable(candidate)) ? await probeVersion(candidate) : null
  if (!version) return probeCandidates(rest)

  return {
    status: isSupportedCodexVersion(version) ? "ready" : "outdated",
    path: candidate,
    version,
  }
}

async function isExecutable(filePath: string) {
  try {
    await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function probeVersion(executablePath: string) {
  return new Promise<string | null>((resolve) => {
    execFile(
      executablePath,
      ["--version"],
      { timeout: VERSION_PROBE_TIMEOUT_MS, windowsHide: true },
      (error, stdout) => resolve(error ? null : parseCodexVersion(stdout)),
    )
  })
}
