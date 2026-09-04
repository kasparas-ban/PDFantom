import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { _electron as electron, type ElectronApplication } from "@playwright/test"

import { BACKGROUND_E2E_SWITCH } from "../../src/shared/application-launch"
import type { ApplicationWindowMode } from "./application-window-mode"

type LaunchTestApplicationOptions = {
  readonly workspacePrefix: string
  readonly windowMode?: ApplicationWindowMode
}

export async function launchTestApplication({
  workspacePrefix,
  windowMode = "background",
}: LaunchTestApplicationOptions) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), `${workspacePrefix}-`))

  try {
    const profilePath = path.join(workspace, "profile")
    const { application, page, launchStartedAt } = await launchApplication(profilePath, windowMode)
    let currentApplication = application

    return {
      electronApplication: application,
      launchStartedAt,
      windowMode,
      page,
      hasVisibleWindow: () => hasVisibleWindow(currentApplication),
      selectOpenPath: (selectedPath: string) => mockOpenDialog(currentApplication, selectedPath),
      relaunch: async () => {
        await currentApplication.close()
        const relaunched = await launchApplication(profilePath, windowMode)
        currentApplication = relaunched.application
        return relaunched
      },
      close: async () => {
        try {
          await currentApplication.close().catch(() => undefined)
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

async function launchApplication(profilePath: string, windowMode: ApplicationWindowMode) {
  const launchStartedAt = performance.now()
  const applicationExecutable = process.env.PDFANTOM_APPLICATION_EXECUTABLE
  const applicationEntry = process.env.PDFANTOM_APPLICATION_ENTRY || ".vite/build/main.js"
  const application = await electron.launch({
    ...(applicationExecutable ? { executablePath: applicationExecutable } : {}),
    args: [
      ...(applicationExecutable ? [] : [path.resolve(applicationEntry)]),
      `--user-data-dir=${profilePath}`,
      ...(windowMode === "background" ? [BACKGROUND_E2E_SWITCH] : []),
    ],
  })

  try {
    return { application, page: await application.firstWindow(), launchStartedAt }
  } catch (error) {
    await application.close().catch(() => undefined)
    throw error
  }
}

async function hasVisibleWindow(application: ElectronApplication) {
  return application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().some((window) => window.isVisible()),
  )
}

async function mockOpenDialog(application: ElectronApplication, selectedPath: string) {
  await application.evaluate(
    ({ dialog }, filePaths) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
    },
    [selectedPath],
  )
}
