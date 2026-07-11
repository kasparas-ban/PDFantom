import { createContext, type PropsWithChildren, useContext, useRef } from "react"
import { useStore } from "zustand"

import {
  createAppConfigStore,
  type AppConfigState,
  type AppConfigStore,
} from "./app-config-store"

const AppConfigStoreContext = createContext<AppConfigStore | null>(null)

export function AppConfigProvider({ children }: PropsWithChildren) {
  const storeRef = useRef<AppConfigStore | null>(null)

  if (!storeRef.current) storeRef.current = createAppConfigStore()

  return (
    <AppConfigStoreContext.Provider value={storeRef.current}>
      {children}
    </AppConfigStoreContext.Provider>
  )
}

export function useAppConfig<T>(selector: (state: AppConfigState) => T) {
  const store = useContext(AppConfigStoreContext)

  if (!store) throw new Error("useAppConfig must be used within an AppConfigProvider")

  return useStore(store, selector)
}
