import { createStore } from "zustand/vanilla"

import { OpenedDocument } from "../../../shared/document-api"

export type AppConfigState = {
  isSidePanelOpen: boolean
  toggleSidePanel: () => void

  activePDF: OpenedDocument | null
  setActivePDF: (activePDF: OpenedDocument | null) => void

  zoom: number
  setZoom: (zoomLevel: number) => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()((set) => ({
    isSidePanelOpen: true,
    toggleSidePanel: () => set((state) => ({ isSidePanelOpen: !state.isSidePanelOpen })),

    activePDF: null,
    setActivePDF: (activePDF) => set({ activePDF }),

    zoom: 1,
    setZoom: (zoom) => set({ zoom }),
  }))

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
