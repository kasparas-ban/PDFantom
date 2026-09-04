import { Activity, useCallback, useEffect, useState } from "react"
import { Outlet, useMatches } from "react-router"

import { createReaderSurfaces } from "./document-reader"
import { createReaderWorker } from "./pdf-reader-runtime"
import { usePlatform } from "./platform"
import { ReaderPage } from "./reader-page"
import { ReaderPreviewCache } from "./reader-preview"
import { ReaderWorkspace } from "./reader-workspace"
import { ChatSessionProvider } from "./sidebar/chat-session"
import { AppConfigProvider, useAppConfig } from "./store/app-config-provider"
import { ReaderSessionProvider, useReaderSessionStore } from "./store/reader-session-provider"

export function AppShell() {
  return (
    <AppConfigProvider>
      <ReaderSessionProvider>
        <Workspace />
      </ReaderSessionProvider>
    </AppConfigProvider>
  )
}

function Workspace() {
  const api = usePlatform()
  const store = useReaderSessionStore()
  const appearance = useAppConfig((state) => state.appearance)
  const readerActive = useMatches().some((match) => match.id === "reader")
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [workspace, setWorkspace] = useState<ReaderWorkspace | null>(null)
  // Activity detaches refs without ending the session. Only owner cleanup disposes it.
  const attachHost = useCallback((element: HTMLDivElement | null) => {
    if (element) setHost(element)
  }, [])

  useEffect(() => {
    const scheme = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () =>
      document.documentElement.classList.toggle(
        "dark",
        appearance === "dark" || (appearance === "system" && scheme.matches),
      )
    sync()
    scheme.addEventListener("change", sync)
    return () => scheme.removeEventListener("change", sync)
  }, [appearance])

  useEffect(() => {
    if (!host) return
    const owner = new ReaderWorkspace(
      api,
      store,
      createReaderSurfaces(host, store),
      new ReaderPreviewCache(),
      createReaderWorker,
    )
    owner.suspend(true)
    setWorkspace(owner)
    void owner.restore()
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => owner.warm())
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      void owner.dispose()
    }
  }, [api, host, store])

  return (
    <ChatSessionProvider>
      <Activity mode={readerActive ? "visible" : "hidden"}>
        <ReaderPage host={attachHost} hostElement={host} workspace={workspace} />
      </Activity>
      <Outlet />
    </ChatSessionProvider>
  )
}
