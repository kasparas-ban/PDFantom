import { createStore } from "zustand/vanilla"
import { persist } from "zustand/middleware"

export const DEFAULT_DOCUMENTS_PANEL_WIDTH = 256
export const DEFAULT_CHAT_PANEL_WIDTH = 320

export type AppConfigState = {
  isChatPanelOpen: boolean
  isDocumentsPanelOpen: boolean
  lastResizedPanel: "chat" | "documents" | null
  preferredChatPanelWidth: number
  preferredDocumentsPanelWidth: number
  setChatPanelWidth: (width: number) => void
  setDocumentsPanelWidth: (width: number) => void
  toggleChatPanel: () => void
  toggleDocumentsPanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()(
    persist(
      (set) => ({
        isChatPanelOpen: false,
        isDocumentsPanelOpen: true,
        lastResizedPanel: null,
        preferredChatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
        preferredDocumentsPanelWidth: DEFAULT_DOCUMENTS_PANEL_WIDTH,
        setChatPanelWidth: (preferredChatPanelWidth) =>
          set({ lastResizedPanel: "chat", preferredChatPanelWidth }),
        setDocumentsPanelWidth: (preferredDocumentsPanelWidth) =>
          set({ lastResizedPanel: "documents", preferredDocumentsPanelWidth }),
        toggleChatPanel: () =>
          set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
        toggleDocumentsPanel: () =>
          set((state) => ({ isDocumentsPanelOpen: !state.isDocumentsPanelOpen })),
      }),
      {
        name: "pdfantom-layout",
        partialize: ({
          isChatPanelOpen,
          isDocumentsPanelOpen,
          lastResizedPanel,
          preferredChatPanelWidth,
          preferredDocumentsPanelWidth,
        }) => ({
          isChatPanelOpen,
          isDocumentsPanelOpen,
          lastResizedPanel,
          preferredChatPanelWidth,
          preferredDocumentsPanelWidth,
        }),
      },
    ),
  )

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
