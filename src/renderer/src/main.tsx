import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { FilePlus2, FileWarning } from "lucide-react"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import pdfantomLogo from "../../../assets/pdfantom-logo.svg?no-inline"
import type { ActiveDocumentState, DocumentUnavailableReason } from "../../shared/document-api"
import { ChatPanelControl } from "./chat-panel-control"
import { createReaderSurfaces } from "./document-reader"
import { DocumentsPanelControl } from "./documents-panel-control"
import { PDFControls } from "./pdf-controls"
import { createReaderWorker } from "./pdf-reader-runtime"
import { ReaderPreviewCache } from "./reader-preview"
import { ReaderWorkspace } from "./reader-workspace"
import { resolveReaderWorkspaceLayout } from "./reader-workspace-layout"
import { SettingsView } from "./settings/settings-view"
import { ResizableChatPanel } from "./sidebar/resizable-chat-panel"
import { ResizableDocumentsPanel } from "./sidebar/resizable-documents-panel"
import { AppConfigProvider, useAppConfig } from "./store/app-config-provider"
import {
  ReaderSessionProvider,
  useReaderSession,
  useReaderSessionStore,
} from "./store/reader-session-provider"

import "pdfjs-dist/web/pdf_viewer.css"
import "./styles.css"

function App() {
  const store = useReaderSessionStore()
  const host = useRef<HTMLDivElement>(null)
  const workspace = useRef<ReaderWorkspace | null>(null)
  const isChatPanelOpen = useAppConfig((state) => state.isChatPanelOpen)
  const isDocumentsPanelOpen = useAppConfig((state) => state.isDocumentsPanelOpen)
  const isSettingsOpen = useAppConfig((state) => state.isSettingsOpen)
  const appearance = useAppConfig((state) => state.appearance)
  const lastResizedPanel = useAppConfig((state) => state.lastResizedPanel)
  const preferredChatPanelWidth = useAppConfig((state) => state.preferredChatPanelWidth)
  const preferredDocumentsPanelWidth = useAppConfig((state) => state.preferredDocumentsPanelWidth)
  const setChatPanelWidth = useAppConfig((state) => state.setChatPanelWidth)
  const setDocumentsPanelWidth = useAppConfig((state) => state.setDocumentsPanelWidth)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)

  const panelLayout = resolveReaderWorkspaceLayout({
    isChatPanelOpen,
    isDocumentsPanelOpen,
    lastResizedPanel,
    preferredChatPanelWidth,
    preferredDocumentsPanelWidth,
    viewportWidth,
  })

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)")
    const syncColorScheme = () => {
      const isDark = appearance === "dark" || (appearance === "system" && colorScheme.matches)
      document.documentElement.classList.toggle("dark", isDark)
    }

    syncColorScheme()
    colorScheme.addEventListener("change", syncColorScheme)
    return () => colorScheme.removeEventListener("change", syncColorScheme)
  }, [appearance])

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth)

    window.addEventListener("resize", updateViewportWidth)
    return () => window.removeEventListener("resize", updateViewportWidth)
  }, [])

  useEffect(() => {
    if (!host.current) return

    const owner = new ReaderWorkspace(
      window.pdfantom,
      store,
      createReaderSurfaces(host.current, store),
      new ReaderPreviewCache(),
      createReaderWorker,
    )

    workspace.current = owner

    const resize = new ResizeObserver(() => owner.layoutChanged())
    resize.observe(host.current)

    const appearanceObserver = new MutationObserver(() => owner.layoutChanged())
    appearanceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    void owner.restore()

    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => owner.warm())
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      workspace.current = null
      resize.disconnect()
      appearanceObserver.disconnect()
      void owner.dispose()
    }
  }, [store])

  useLayoutEffect(() => workspace.current?.suspend(isSettingsOpen), [isSettingsOpen])

  const openDocument = () => {
    void workspace.current?.open()
  }

  const activateDocument = (documentId: string) => {
    void workspace.current?.activate(documentId)
  }

  return (
    <>
      {isSettingsOpen && <SettingsView />}
      <main
        aria-hidden={isSettingsOpen || undefined}
        inert={isSettingsOpen}
        className={`flex h-screen bg-background text-foreground ${isSettingsOpen ? "invisible absolute inset-0" : ""}`}
      >
        {isDocumentsPanelOpen && (
          <ResizableDocumentsPanel
            maximumWidth={panelLayout.documentsPanel.maximumWidth}
            onActivateDocument={activateDocument}
            onOpenDocument={openDocument}
            onWidthChange={setDocumentsPanelWidth}
            width={panelLayout.documentsPanel.width}
          />
        )}

        <section className="flex h-full min-w-0 flex-1 flex-col">
          <div className="window-drag-region h-12">
            <PDFControls />
          </div>

          <div className="flex min-h-0 w-full flex-1">
            <PDFCanvas host={host} openDocument={openDocument} />
          </div>
        </section>

        {isChatPanelOpen && (
          <ResizableChatPanel
            maximumWidth={panelLayout.chatPanel.maximumWidth}
            onWidthChange={setChatPanelWidth}
            width={panelLayout.chatPanel.width}
          />
        )}

        <DocumentsPanelControl />
        <ChatPanelControl />
      </main>
    </>
  )
}

function PDFCanvas({
  host,
  openDocument,
}: {
  host: RefObject<HTMLDivElement | null>
  openDocument: () => void
}) {
  const activeDocument = useReaderSession((state) => state.activeDocument)
  const error = useReaderSession((state) => state.error)
  const positionError = useReaderSession((state) => state.readingPositionError)
  const sourceStatus = useReaderSession((state) => state.sourceStatus)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={host} className="absolute inset-0 bg-[#e7e7e5] dark:bg-[#171716]" />
      {(error || positionError) && (
        <div
          className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border bg-background px-4 py-2 text-sm text-destructive shadow-sm"
          role="alert"
        >
          {error || positionError}
        </div>
      )}

      {sourceStatus && (
        <output className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground">
          {sourceStatus === "checking" ? "Checking source…" : "Preparing reader…"}
        </output>
      )}
      {activeDocument.status === "unavailable" && (
        <UnavailableDocument activeDocument={activeDocument} openDocument={openDocument} />
      )}
      {activeDocument.status === "none" && (
        <div className="relative flex h-full w-full items-center justify-center bg-background">
          <section className="flex items-center justify-center px-8 pb-[8vh] text-center">
            <div className="max-w-md">
              <img
                alt=""
                aria-hidden="true"
                className="mx-auto mb-6 size-14 rounded-2xl opacity-65 grayscale"
                src={pdfantomLogo}
              />
              <h2 className="text-[1.75rem] font-medium tracking-[-0.035em]">
                Open a PDF in PDFantom
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Read and select text from local PDFs. Your PDFs stay on this Mac.
              </p>
              <Button className="mt-6 rounded-xl px-4" onClick={openDocument} type="button">
                <FilePlus2 />
                Choose a PDF
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

type UnavailableActiveDocument = Extract<ActiveDocumentState, { readonly status: "unavailable" }>

const unavailableDocumentMessages: Record<DocumentUnavailableReason, string> = {
  "content-mismatch":
    "The file's contents changed after it was added. Open it again to use the current version.",
  invalid: "The saved file is no longer a valid PDF. Restore it or choose another file.",
  missing:
    "The file was moved or deleted. Restore it to its saved location, or open it again from its new location.",
  unreadable: "PDFantom cannot read the saved file. Check its permissions, then try again.",
}

function UnavailableDocument({
  activeDocument,
  openDocument,
}: {
  activeDocument: UnavailableActiveDocument
  openDocument: () => void
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-background">
      <section className="flex items-center justify-center px-8 pb-[8vh] text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FileWarning aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-[1.75rem] font-medium tracking-[-0.035em]">
            {activeDocument.document.name} is unavailable
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {unavailableDocumentMessages[activeDocument.reason]}
          </p>
          <Button className="mt-6 rounded-xl px-4" onClick={openDocument} type="button">
            <FilePlus2 />
            Choose a PDF
          </Button>
        </div>
      </section>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppConfigProvider>
      <ReaderSessionProvider>
        <App />
      </ReaderSessionProvider>
    </AppConfigProvider>
  </StrictMode>,
)
