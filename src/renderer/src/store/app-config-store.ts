import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import type { ReaderPanelId } from "../reader/reader-workspace-layout"

export const DEFAULT_DOCUMENTS_PANEL_WIDTH = 256
export const DEFAULT_CHAT_PANEL_WIDTH = 360

export type Appearance = "dark" | "light" | "system"

export type AppConfigState = {
  appearance: Appearance
  collapsedDocumentIds: readonly string[]
  expandDocumentChatThreads: (documentId: string) => void
  isChatPanelOpen: boolean
  isDocumentsPanelOpen: boolean
  isSideChatPanelOpen: boolean
  lastResizedPanel: ReaderPanelId | null
  preferredChatPanelWidth: number
  preferredDocumentsPanelWidth: number
  preferredSideChatPanelWidth: number
  skipSideChatCloseConfirmation: boolean
  setAppearance: (appearance: Appearance) => void
  setChatPanelWidth: (width: number) => void
  setDocumentsPanelWidth: (width: number) => void
  setSideChatPanelWidth: (width: number) => void
  setSkipSideChatCloseConfirmation: (skip: boolean) => void
  openChatPanel: () => void
  openSideChatPanel: () => void
  toggleChatPanel: () => void
  toggleDocumentChatThreads: (documentId: string) => void
  toggleDocumentsPanel: () => void
  toggleSideChatPanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()(
    persist(
      (set) => ({
        appearance: "system",
        collapsedDocumentIds: [],
        expandDocumentChatThreads: (documentId) =>
          set((state) =>
            state.collapsedDocumentIds.includes(documentId)
              ? {
                  collapsedDocumentIds: state.collapsedDocumentIds.filter(
                    (id) => id !== documentId,
                  ),
                }
              : state,
          ),
        isChatPanelOpen: false,
        isDocumentsPanelOpen: true,
        isSideChatPanelOpen: false,
        lastResizedPanel: null,
        preferredChatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
        preferredDocumentsPanelWidth: DEFAULT_DOCUMENTS_PANEL_WIDTH,
        preferredSideChatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
        skipSideChatCloseConfirmation: false,
        setAppearance: (appearance) => set({ appearance }),
        setChatPanelWidth: (preferredChatPanelWidth) =>
          set({ lastResizedPanel: "chat", preferredChatPanelWidth }),
        setDocumentsPanelWidth: (preferredDocumentsPanelWidth) =>
          set({ lastResizedPanel: "documents", preferredDocumentsPanelWidth }),
        setSideChatPanelWidth: (preferredSideChatPanelWidth) =>
          set({ lastResizedPanel: "side-chat", preferredSideChatPanelWidth }),
        setSkipSideChatCloseConfirmation: (skipSideChatCloseConfirmation) =>
          set({ skipSideChatCloseConfirmation }),
        openChatPanel: () => set({ isChatPanelOpen: true }),
        openSideChatPanel: () => set({ isSideChatPanelOpen: true }),
        toggleChatPanel: () => set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
        toggleDocumentChatThreads: (documentId) =>
          set((state) => ({
            collapsedDocumentIds: state.collapsedDocumentIds.includes(documentId)
              ? state.collapsedDocumentIds.filter((id) => id !== documentId)
              : [...state.collapsedDocumentIds, documentId],
          })),
        toggleDocumentsPanel: () =>
          set((state) => ({ isDocumentsPanelOpen: !state.isDocumentsPanelOpen })),
        toggleSideChatPanel: () =>
          set((state) => ({ isSideChatPanelOpen: !state.isSideChatPanelOpen })),
      }),
      {
        name: "pdfantom-layout",
        partialize: ({
          appearance,
          collapsedDocumentIds,
          isChatPanelOpen,
          isDocumentsPanelOpen,
          isSideChatPanelOpen,
          lastResizedPanel,
          preferredChatPanelWidth,
          preferredDocumentsPanelWidth,
          preferredSideChatPanelWidth,
          skipSideChatCloseConfirmation,
        }) => ({
          appearance,
          collapsedDocumentIds,
          isChatPanelOpen,
          isDocumentsPanelOpen,
          isSideChatPanelOpen,
          lastResizedPanel,
          preferredChatPanelWidth,
          preferredDocumentsPanelWidth,
          preferredSideChatPanelWidth,
          skipSideChatCloseConfirmation,
        }),
      },
    ),
  )

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
