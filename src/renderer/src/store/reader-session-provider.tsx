import { createContext, type PropsWithChildren, useContext, useRef } from "react"
import { useStore } from "zustand"

import {
  createReaderSessionStore,
  type ReaderSessionState,
  type ReaderSessionStore,
} from "./reader-session-store"

const ReaderSessionStoreContext = createContext<ReaderSessionStore | null>(null)

export function ReaderSessionProvider({ children }: PropsWithChildren) {
  const storeRef = useRef<ReaderSessionStore | null>(null)

  if (!storeRef.current) storeRef.current = createReaderSessionStore()

  return (
    <ReaderSessionStoreContext.Provider value={storeRef.current}>
      {children}
    </ReaderSessionStoreContext.Provider>
  )
}

export function useReaderSession<T>(selector: (state: ReaderSessionState) => T) {
  const store = useContext(ReaderSessionStoreContext)

  if (!store) throw new Error("useReaderSession must be used within a ReaderSessionProvider")

  return useStore(store, selector)
}
