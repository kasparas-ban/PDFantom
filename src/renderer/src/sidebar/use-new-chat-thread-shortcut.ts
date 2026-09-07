import { useEffect } from "react"

import { useAppConfig } from "../store/app-config-provider"
import { useReaderSessionStore } from "../store/reader-session-provider"
import { useChatThreadStore } from "./chat-session"

/** ⌘N starts a Draft on the selected Document, the keyboard route to the hover button. */
export function useNewChatThreadShortcut() {
  const sessionStore = useReaderSessionStore()
  const threadStore = useChatThreadStore()
  const openChatPanel = useAppConfig((state) => state.openChatPanel)

  useEffect(() => {
    const startThread = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "n"
      ) {
        return
      }

      const document = sessionStore.getState().selectedDocument
      if (!document) return

      threadStore.getState().startDraft(document.id)
      openChatPanel()
      event.preventDefault()
    }

    window.addEventListener("keydown", startThread)
    return () => window.removeEventListener("keydown", startThread)
  }, [openChatPanel, sessionStore, threadStore])
}
