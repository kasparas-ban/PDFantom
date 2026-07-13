import { StrictMode, useEffect, useState } from "react"
import { FilePlus2, FileWarning } from "lucide-react"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import pdfantomLogo from "../../../assets/pdfantom-logo.svg?no-inline"
import type { ActiveDocumentState, DocumentUnavailableReason } from "../../shared/document-api"
import { DocumentReader } from "./document-reader"
import { PDFControls } from "./pdf-controls"
import { ResizableAppSidebar } from "./sidebar/resizable-app-sidebar"
import { AppConfigProvider, useAppConfig } from "./store/app-config-provider"
import { ReaderSessionProvider, useReaderSession } from "./store/reader-session-provider"
import { TopControl } from "./top-control"

import "pdfjs-dist/web/pdf_viewer.css"
import "./styles.css"

function App() {
  const loadDocumentLibrary = useReaderSession((state) => state.loadDocumentLibrary)
  const isSidePanelOpen = useAppConfig((state) => state.isSidePanelOpen)

  const [error, setError] = useState<string | null>(null)

  // TODO: Implement this in a nicer way
  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)")
    const syncColorScheme = () => {
      document.documentElement.classList.toggle("dark", colorScheme.matches)
    }

    syncColorScheme()
    colorScheme.addEventListener("change", syncColorScheme)
    return () => colorScheme.removeEventListener("change", syncColorScheme)
  }, [])

  useEffect(() => {
    let isCurrent = true

    void window.pdfantom
      .getDocumentLibrary()
      .then((snapshot) => {
        if (isCurrent) loadDocumentLibrary(snapshot)
      })
      .catch(() => {
        if (!isCurrent) return
        setError("The document library could not be loaded.")
        loadDocumentLibrary({ activeDocument: { status: "none" }, documents: [] })
      })

    return () => {
      isCurrent = false
    }
  }, [loadDocumentLibrary])

  const openDocument = async () => {
    setError(null)
    try {
      const snapshot = await window.pdfantom.openDocument()
      if (snapshot) {
        setError(null)
        loadDocumentLibrary(snapshot)
      }
    } catch {
      setError("The document could not be opened.")
    }
  }

  const activateDocument = async (documentId: string) => {
    setError(null)
    try {
      const snapshot = await window.pdfantom.activateDocument(documentId)
      setError(null)
      loadDocumentLibrary(snapshot)
    } catch {
      setError("The document is unavailable. Restore the file and try again.")
      try {
        loadDocumentLibrary(await window.pdfantom.getDocumentLibrary())
      } catch {
        // Keep the current renderer state when the library cannot be refreshed.
      }
    }
  }

  return (
    <main className="flex h-screen bg-background text-foreground">
      {isSidePanelOpen && (
        <ResizableAppSidebar onActivateDocument={activateDocument} onOpenDocument={openDocument} />
      )}

      <section className="flex h-full min-w-0 flex-1 flex-col">
        <div className="window-drag-region h-12">
          <PDFControls />
        </div>

        <div className="flex min-h-0 w-full flex-1">
          <PDFCanvas error={error} openDocument={openDocument} />
        </div>
      </section>

      <TopControl />
    </main>
  )
}

function PDFCanvas({ error, openDocument }: { error: string | null; openDocument: () => void }) {
  const activeDocument = useReaderSession((state) => state.activeDocument)
  const isDocumentLibraryHydrated = useReaderSession((state) => state.isDocumentLibraryHydrated)

  return (
    <>
      {error && (
        <div
          className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border bg-background px-4 py-2 text-sm text-destructive shadow-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {!isDocumentLibraryHydrated ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Restoring document…
        </div>
      ) : activeDocument.status === "loaded" ? (
        <DocumentReader document={activeDocument.document} />
      ) : activeDocument.status === "unavailable" ? (
        <UnavailableDocument activeDocument={activeDocument} openDocument={openDocument} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
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
    </>
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
    <div className="flex h-full w-full items-center justify-center">
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
