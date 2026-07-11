import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { _electron as electron, type ElectronApplication } from "@playwright/test"

type LaunchTestApplicationOptions = {
  readonly createOpenPath?: (workspace: string) => Promise<string>
  readonly workspacePrefix: string
}

export async function launchTestApplication({
  createOpenPath,
  workspacePrefix,
}: LaunchTestApplicationOptions) {
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

async function launchApplication(profilePath: string, selectedPath: string | undefined) {
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

async function mockOpenDialog(application: ElectronApplication, selectedPath: string) {
  await application.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [selectedPath],
  )
}
