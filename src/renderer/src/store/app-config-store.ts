import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

export const DEFAULT_DOCUMENTS_PANEL_WIDTH = 256
export const DEFAULT_CHAT_PANEL_WIDTH = 360

export type Appearance = "dark" | "light" | "system"

export type AppConfigState = {
  appearance: Appearance
  collapsedDocumentIds: readonly string[]
  isChatPanelOpen: boolean
  isDocumentsPanelOpen: boolean
  lastResizedPanel: "chat" | "documents" | null
  preferredChatPanelWidth: number
  preferredDocumentsPanelWidth: number
  setAppearance: (appearance: Appearance) => void
  setChatPanelWidth: (width: number) => void
  setDocumentsPanelWidth: (width: number) => void
  openChatPanel: () => void
  toggleChatPanel: () => void
  toggleDocumentChatThreads: (documentId: string) => void
  toggleDocumentsPanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()(
    persist(
      (set) => ({
        appearance: "system",
        collapsedDocumentIds: [],
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
        openChatPanel: () => set({ isChatPanelOpen: true }),
        toggleChatPanel: () => set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
        toggleDocumentChatThreads: (documentId) =>
          set((state) => ({
            collapsedDocumentIds: state.collapsedDocumentIds.includes(documentId)
              ? state.collapsedDocumentIds.filter((id) => id !== documentId)
              : [...state.collapsedDocumentIds, documentId],
          })),
        toggleDocumentsPanel: () =>
          set((state) => ({ isDocumentsPanelOpen: !state.isDocumentsPanelOpen })),
      }),
      {
        name: "pdfantom-layout",
        partialize: ({
          appearance,
          collapsedDocumentIds,
          isChatPanelOpen,
          isDocumentsPanelOpen,
          lastResizedPanel,
          preferredChatPanelWidth,
          preferredDocumentsPanelWidth,
        }) => ({
          appearance,
          collapsedDocumentIds,
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
