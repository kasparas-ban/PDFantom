import { Activity, useCallback, useEffect, useState } from "react"
import { Outlet, useMatches } from "react-router"

import { createReaderSurfaces } from "../reader/document-reader"
import { createReaderWorker } from "../reader/pdf-reader-runtime"
import { usePlatform } from "./platform"
import { ReaderPage } from "../reader/reader-page"
import { ReaderPreviewCache } from "../reader/reader-preview"
import { ReaderWorkspace } from "../reader/reader-workspace"
import { ChatSessionProvider } from "../sidebar/chat-session"
import { AppConfigProvider, useAppConfig } from "../store/app-config-provider"
import { ReaderSessionProvider, useReaderSessionStore } from "../store/reader-session-provider"

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
  const platform = usePlatform()
  const sessionStore = useReaderSessionStore()
  const appearance = useAppConfig((state) => state.appearance)
  const isReaderActive = useMatches().some((match) => match.id === "reader")
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [workspace, setWorkspace] = useState<ReaderWorkspace | null>(null)

  // Activity disconnects refs while retaining the DOM. Ignore that null so hiding the
  // reader does not dispose its session; a genuine Workspace unmount runs owner cleanup.
  const attachHost = useCallback((element: HTMLDivElement | null) => {
    if (element) setHost(element)
  }, [])

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)")
    const syncAppearance = () =>
      document.documentElement.classList.toggle(
        "dark",
        appearance === "dark" || (appearance === "system" && colorScheme.matches),
      )

    syncAppearance()
    colorScheme.addEventListener("change", syncAppearance)

    return () => colorScheme.removeEventListener("change", syncAppearance)
  }, [appearance])

  useEffect(() => {
    if (!host) return

    const owner = new ReaderWorkspace(
      platform,
      sessionStore,
      createReaderSurfaces(host, sessionStore),
      new ReaderPreviewCache(),
      createReaderWorker,
    )

    // ReaderLifecycle is the sole resumer and only mounts while Activity is visible.
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
  }, [host, platform, sessionStore])

  return (
    <ChatSessionProvider>
      <Activity mode={isReaderActive ? "visible" : "hidden"}>
        <ReaderPage host={attachHost} hostElement={host} workspace={workspace} />
      </Activity>
      <Outlet />
    </ChatSessionProvider>
  )
}
