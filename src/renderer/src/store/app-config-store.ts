import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

export const DEFAULT_DOCUMENTS_PANEL_WIDTH = 256
export const DEFAULT_CHAT_PANEL_WIDTH = 320

export type Appearance = "dark" | "light" | "system"

export type AppConfigState = {
  appearance: Appearance
  isChatPanelOpen: boolean
  isDocumentsPanelOpen: boolean
  lastResizedPanel: "chat" | "documents" | null
  preferredChatPanelWidth: number
  preferredDocumentsPanelWidth: number
  setAppearance: (appearance: Appearance) => void
  setChatPanelWidth: (width: number) => void
  setDocumentsPanelWidth: (width: number) => void
  toggleChatPanel: () => void
  toggleDocumentsPanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()(
    persist(
      (set) => ({
        appearance: "system",
        isChatPanelOpen: false,
        isDocumentsPanelOpen: true,
        lastResizedPanel: null,
        preferredChatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
        preferredDocumentsPanelWidth: DEFAULT_DOCUMENTS_PANEL_WIDTH,
        setAppearance: (appearance) => set({ appearance }),
        setChatPanelWidth: (preferredChatPanelWidth) =>
          set({ lastResizedPanel: "chat", preferredChatPanelWidth }),
        setDocumentsPanelWidth: (preferredDocumentsPanelWidth) =>
          set({ lastResizedPanel: "documents", preferredDocumentsPanelWidth }),
        toggleChatPanel: () => set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
        toggleDocumentsPanel: () =>
          set((state) => ({ isDocumentsPanelOpen: !state.isDocumentsPanelOpen })),
      }),
      {
        name: "pdfantom-layout",
        partialize: ({
          appearance,
          isChatPanelOpen,
          isDocumentsPanelOpen,
          lastResizedPanel,
          preferredChatPanelWidth,
          preferredDocumentsPanelWidth,
        }) => ({
          appearance,
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
