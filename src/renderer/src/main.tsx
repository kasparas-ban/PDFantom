import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { FilePlus2, PanelLeftClose } from "lucide-react"

import { Button } from "@/components/ui/button"
import pdfantomLogo from "../../../assets/pdfantom-logo.svg?no-inline"
import type { OpenedTextbook } from "../../shared/textbook-api"
import { AppSidebar } from "./app-sidebar"
import { TextbookReader } from "./textbook-reader"

import "pdfjs-dist/web/pdf_viewer.css"
import "./styles.css"

function App() {
  const [textbook, setTextbook] = useState<OpenedTextbook | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
      if (openedTextbook) setTextbook(openedTextbook)
    } catch {
      setError("The textbook could not be opened.")
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen && (
        <AppSidebar
          onClose={() => setSidebarOpen(false)}
          onOpenTextbook={openTextbook}
          textbook={textbook}
        />
      )}

      <section className="min-w-0 flex-1">
        {error && (
          <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-lg border bg-background px-4 py-2 text-sm text-destructive shadow-sm" role="alert">
            {error}
          </div>
        )}

        {textbook ? (
          <TextbookReader
            onShowSidebar={() => setSidebarOpen(true)}
            sidebarOpen={sidebarOpen}
            textbook={textbook}
          />
        ) : (
          <div className="grid h-full grid-rows-[3rem_minmax(0,1fr)]">
            <header className="window-drag-region flex items-center border-b border-border/70 px-3">
              {!sidebarOpen && (
                <Button
                  aria-label="Show sidebar"
                  className="window-no-drag text-muted-foreground"
                  onClick={() => setSidebarOpen(true)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <PanelLeftClose className="rotate-180" />
                </Button>
              )}
            </header>
            <section className="flex items-center justify-center px-8 pb-[8vh] text-center">
              <div className="max-w-md">
                <img
                  alt=""
                  aria-hidden="true"
                  className="mx-auto mb-6 size-14 rounded-2xl opacity-65 grayscale"
                  src={pdfantomLogo}
                />
                <h2 className="text-[1.75rem] font-medium tracking-[-0.035em]">
                  Open a textbook in PDFantom
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Read and select text from local PDFs. Your textbooks stay on this Mac.
                </p>
                <Button className="mt-6 rounded-xl px-4" onClick={openTextbook} type="button">
                  <FilePlus2 />
                  Choose a PDF
                </Button>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
