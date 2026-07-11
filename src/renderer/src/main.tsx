import { StrictMode, useEffect, useState } from "react"
import { FilePlus2 } from "lucide-react"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import pdfantomLogo from "../../../assets/pdfantom-logo.svg?no-inline"
import { PDFControls } from "./pdf-controls"
import { AppSidebar } from "./sidebar/app-sidebar"
import { AppConfigProvider, useAppConfig } from "./store/app-config-provider"
import { TextbookReader } from "./textbook-reader"
import { TopControl } from "./top-control"

import "pdfjs-dist/web/pdf_viewer.css"
import "./styles.css"

function App() {
  const setActivePDF = useAppConfig((state) => state.setActivePDF)
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

  const openTextbook = async () => {
    setError(null)
    try {
      const openedTextbook = await window.pdfantom.openTextbook()
      if (openedTextbook) setActivePDF(openedTextbook)
    } catch {
      setError("The textbook could not be opened.")
    }
  }

  return (
    <main className="flex h-screen bg-background text-foreground">
      {isSidePanelOpen && (
        <div className="h-full w-64 shrink-0">
          <AppSidebar onOpenTextbook={openTextbook} />
        </div>
      )}

      <section className="min-w-0 flex-1">
        <div className="window-drag-region h-12">
          <PDFControls />
        </div>

        <div className="flex h-full w-full">
          <PDFCanvas error={error} openTextbook={openTextbook} />
        </div>
      </section>

      <TopControl />
    </main>
  )
}

function PDFCanvas({ error, openTextbook }: { error: string | null; openTextbook: () => void }) {
  const activePDF = useAppConfig((state) => state.activePDF)

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

      {activePDF ? (
        <TextbookReader textbook={activePDF} />
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
              <Button className="mt-6 rounded-xl px-4" onClick={openTextbook} type="button">
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </StrictMode>,
)
