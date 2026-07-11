import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test"

interface LaunchTestApplicationOptions {
  readonly createOpenPath?: (workspace: string) => Promise<string>
  readonly workspacePrefix: string
}

export interface RunningApplication {
  readonly page: Page
  close(): Promise<void>
}

async function mockOpenDialog(
  application: ElectronApplication,
  selectedPath: string,
): Promise<void> {
  await application.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [selectedPath],
  )
}

async function launchApplication(
  profilePath: string,
  selectedPath: string | undefined,
): Promise<{ application: ElectronApplication; page: Page }> {
  const application = await electron.launch({
    args: [path.resolve(".vite/build/main.js"), `--user-data-dir=${profilePath}`],
  })

  try {
    if (selectedPath) await mockOpenDialog(application, selectedPath)
    return { application, page: await application.firstWindow() }
  } catch (error) {
    await application.close().catch(() => undefined)
    throw error
  }
}

export async function launchTestApplication({
  createOpenPath,
  workspacePrefix,
}: LaunchTestApplicationOptions): Promise<RunningApplication> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `${workspacePrefix}-`))

  try {
    const selectedPath = await createOpenPath?.(workspace)
    const profilePath = path.join(workspace, "profile")
    const { application, page } = await launchApplication(profilePath, selectedPath)

    return {
      page,
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
