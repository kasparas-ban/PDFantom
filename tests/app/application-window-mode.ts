export type ApplicationWindowMode = "background" | "visible"

export function configuredApplicationWindowMode() {
  const configuredMode = process.env.PDFANTOM_E2E_WINDOW

  if (configuredMode === undefined || configuredMode === "background") {
    return "background"
  }

  if (configuredMode === "visible") {
    return "visible"
  }

  throw new Error(
    `Unsupported PDFANTOM_E2E_WINDOW value "${configuredMode}". Expected "background" or "visible".`,
  )
}
