export const GET_OPENROUTER_API_KEY_STATUS_CHANNEL =
  "settings:get-openrouter-api-key-status"
export const GET_OPENROUTER_API_KEY_CHANNEL = "settings:get-openrouter-api-key"
export const SAVE_OPENROUTER_API_KEY_CHANNEL = "settings:save-openrouter-api-key"

export type OpenRouterApiKeyStatus = {
  readonly isConfigured: boolean
}

export type SettingsApi = {
  getOpenRouterApiKey(): Promise<string | null>
  getOpenRouterApiKeyStatus(): Promise<OpenRouterApiKeyStatus>
  saveOpenRouterApiKey(apiKey: string): Promise<void>
}
