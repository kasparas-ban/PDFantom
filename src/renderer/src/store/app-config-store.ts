import { createStore } from "zustand/vanilla"

export type AppConfigState = {
  isSidePanelOpen: boolean
  toggleSidePanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()((set) => ({
    isSidePanelOpen: true,
    toggleSidePanel: () => set((state) => ({ isSidePanelOpen: !state.isSidePanelOpen })),
  }))

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
