export const GET_OPENROUTER_API_KEY_STATUS_CHANNEL = "settings:get-openrouter-api-key-status"
export const GET_OPENROUTER_API_KEY_CHANNEL = "settings:get-openrouter-api-key"
export const SAVE_OPENROUTER_API_KEY_CHANNEL = "settings:save-openrouter-api-key"
export const GET_CODEX_SETTINGS_CHANNEL = "settings:get-codex-settings"
export const SAVE_CODEX_EXECUTABLE_PATH_CHANNEL = "settings:save-codex-executable-path"

export type OpenRouterApiKeyStatus = {
  readonly isConfigured: boolean
}

export type CodexSessionStatus =
  | { readonly available: true; readonly executablePath: string; readonly version: string }
  | {
      readonly available: false
      readonly reason: string
      readonly executablePath?: string
      readonly version?: string
    }

export type CodexSettings = {
  readonly executablePathOverride: string | null
  readonly session: CodexSessionStatus
}

export type SettingsApi = {
  getOpenRouterApiKey(): Promise<string | null>
  getOpenRouterApiKeyStatus(): Promise<OpenRouterApiKeyStatus>
  saveOpenRouterApiKey(apiKey: string): Promise<void>
  getCodexSettings(): Promise<CodexSettings>
  saveCodexExecutablePath(executablePath: string): Promise<CodexSettings>
}
