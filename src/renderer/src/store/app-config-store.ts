import { createStore } from "zustand/vanilla"

export const DEFAULT_DOCUMENTS_PANEL_WIDTH = 256

export type AppConfigState = {
  documentsPanelWidth: number
  isChatPanelOpen: boolean
  isDocumentsPanelOpen: boolean
  setDocumentsPanelWidth: (width: number) => void
  toggleChatPanel: () => void
  toggleDocumentsPanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()((set) => ({
    documentsPanelWidth: DEFAULT_DOCUMENTS_PANEL_WIDTH,
    isChatPanelOpen: false,
    isDocumentsPanelOpen: true,
    setDocumentsPanelWidth: (documentsPanelWidth) => set({ documentsPanelWidth }),
    toggleChatPanel: () =>
      set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
    toggleDocumentsPanel: () =>
      set((state) => ({ isDocumentsPanelOpen: !state.isDocumentsPanelOpen })),
  }))

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
