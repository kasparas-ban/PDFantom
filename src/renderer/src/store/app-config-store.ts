import { createStore } from "zustand/vanilla"

export const DEFAULT_SIDE_PANEL_WIDTH = 256

export type AppConfigState = {
  isSidePanelOpen: boolean
  setSidePanelWidth: (width: number) => void
  sidePanelWidth: number
  toggleSidePanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()((set) => ({
    isSidePanelOpen: true,
    setSidePanelWidth: (sidePanelWidth) => set({ sidePanelWidth }),
    sidePanelWidth: DEFAULT_SIDE_PANEL_WIDTH,
    toggleSidePanel: () => set((state) => ({ isSidePanelOpen: !state.isSidePanelOpen })),
  }))

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
