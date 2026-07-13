export const BACKGROUND_E2E_SWITCH = "--pdfantom-e2e-background"

type ApplicationLaunchEnvironment = {
  readonly commandLine: readonly string[]
  readonly isPackaged: boolean
  readonly platform: NodeJS.Platform
}

export function resolveApplicationLaunchConfiguration({
  commandLine,
  isPackaged,
  platform,
}: ApplicationLaunchEnvironment) {
  const runsInBackgroundE2E = commandLine.includes(BACKGROUND_E2E_SWITCH)

  return {
    activationPolicy:
      runsInBackgroundE2E && platform === "darwin" ? ("accessory" as const) : undefined,
    setDevelopmentDockIcon: platform === "darwin" && !isPackaged && !runsInBackgroundE2E,
    showWindow: !runsInBackgroundE2E,
  }
}
