import type { ChatApi } from "./chat-api"
import type { DocumentApi } from "./document-api"
import type { SettingsApi } from "./settings-api"
import type { WindowApi } from "./window-api"

export const RENDERER_API_GLOBAL = "pdfantom" as const

export type RendererApi = DocumentApi & SettingsApi & WindowApi & ChatApi
