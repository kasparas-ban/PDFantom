import { useEffect } from "react"

import { useAppConfig } from "../store/app-config-provider"
import { getPanelShortcut } from "./panel-shortcut"

export function usePanelShortcuts() {
  const toggleChatPanel = useAppConfig((state) => state.toggleChatPanel)
  const toggleDocumentsPanel = useAppConfig((state) => state.toggleDocumentsPanel)

  useEffect(() => {
    const togglePanel = (event: KeyboardEvent) => {
      const panel = getPanelShortcut(event)
      if (!panel) return

      event.preventDefault()

      if (panel === "chat") {
        toggleChatPanel()
      } else {
        toggleDocumentsPanel()
      }
    }

    window.addEventListener("keydown", togglePanel)
    return () => window.removeEventListener("keydown", togglePanel)
  }, [toggleChatPanel, toggleDocumentsPanel])
}
