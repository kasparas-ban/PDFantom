import { createContext, useContext } from "react"

import type { ChatApi } from "../../../shared/chat-api"
import type { ChatThreadApi } from "../../../shared/chat-thread-api"
import type { DocumentApi } from "../../../shared/document-api"
import type { SettingsApi } from "../../../shared/settings-api"
import type { WindowApi } from "../../../shared/window-api"

export type Platform = DocumentApi & SettingsApi & WindowApi & ChatApi & ChatThreadApi
export const PlatformContext = createContext<Platform | null>(null)

export function usePlatform() {
  const platform = useContext(PlatformContext)
  if (!platform) throw new Error("PlatformContext is required")
  return platform
}
