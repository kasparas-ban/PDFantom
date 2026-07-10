import { spawn, type ChildProcess } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import electronExecutable from "electron"
import { chromium, type Browser, type Page } from "@playwright/test"

interface LaunchTestApplicationOptions {
  readonly createOpenPath?: (workspace: string) => Promise<string>
  readonly workspacePrefix: string
}

export interface RunningApplication {
  readonly page: Page
  close(): Promise<void>
}

function waitForDevToolsEndpoint(applicationProcess: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let stderr = ""
    const timeout = setTimeout(
      () => reject(new Error(`Electron did not expose DevTools.\n${stderr}`)),
      10_000,
    )

    applicationProcess.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
      const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]
      if (endpoint) {
        clearTimeout(timeout)
        resolve(endpoint)
      }
    })
    applicationProcess.once("exit", (code, signal) => {
      clearTimeout(timeout)
      reject(new Error(`Electron exited before startup (${code ?? signal}).\n${stderr}`))
    })
  })
}

async function closeApplication(applicationProcess: ChildProcess, browser: Browser): Promise<void> {
  await browser.close().catch(() => undefined)
  if (applicationProcess.exitCode === null && applicationProcess.signalCode === null) {
    applicationProcess.kill("SIGTERM")
    await Promise.race([
      once(applicationProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ])
  }
}

async function launchApplication(env: NodeJS.ProcessEnv): Promise<RunningApplication> {
  if (typeof electronExecutable !== "string") {
    throw new TypeError("Electron did not provide an executable path.")
  }

  const applicationProcess = spawn(
    electronExecutable,
    ["--remote-debugging-port=0", path.resolve(".vite/build/main.js")],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  const endpoint = await waitForDevToolsEndpoint(applicationProcess)
  const browser = await chromium.connectOverCDP(endpoint)
  const context = browser.contexts()[0]
  if (!context) {
    await closeApplication(applicationProcess, browser)
    throw new Error("Electron did not create a browser context.")
  }

  const page = context.pages()[0] ?? (await context.waitForEvent("page"))
  return {
    page,
    close: () => closeApplication(applicationProcess, browser),
  }
}

export async function launchTestApplication({
  createOpenPath,
  workspacePrefix,
}: LaunchTestApplicationOptions): Promise<RunningApplication> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `${workspacePrefix}-`))

  try {
    const selectedPath = await createOpenPath?.(workspace)
    const application = await launchApplication({
      ...process.env,
      PDFANTOM_TEST_OPEN_PATH: selectedPath,
      PDFANTOM_TEST_PROFILE: path.join(workspace, "profile"),
    })

    return {
      page: application.page,
      close: async () => {
        try {
          await application.close()
        } finally {
          await rm(workspace, { recursive: true, force: true })
        }
      },
    }
  } catch (error) {
    await rm(workspace, { recursive: true, force: true })
    throw error
  }
}
