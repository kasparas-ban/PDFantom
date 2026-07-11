import { createStore } from "zustand/vanilla"

export type AppConfigState = {
  isSidePanelOpen: boolean
  setSidePanelOpen: (isOpen: boolean) => void
  toggleSidePanel: () => void
}

export const createAppConfigStore = () =>
  createStore<AppConfigState>()((set) => ({
    isSidePanelOpen: true,
    setSidePanelOpen: (isOpen) => set({ isSidePanelOpen: isOpen }),
    toggleSidePanel: () => set((state) => ({ isSidePanelOpen: !state.isSidePanelOpen })),
  }))

export type AppConfigStore = ReturnType<typeof createAppConfigStore>
