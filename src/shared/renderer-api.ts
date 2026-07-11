import type { DocumentApi } from "./document-api"
import type { WindowApi } from "./window-api"

export const RENDERER_API_GLOBAL = "pdfantom" as const

export type RendererApi = DocumentApi & WindowApi
