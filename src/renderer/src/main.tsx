import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import pdfantomLogo from "../../../assets/pdfantom-logo.svg?no-inline"
import type { OpenedTextbook } from "../../shared/textbook-api"
import { TextbookReader } from "./textbook-reader"

import "pdfjs-dist/web/pdf_viewer.css"
import "./styles.css"

function App() {
  const [textbook, setTextbook] = useState<OpenedTextbook | null>(null)
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
      if (openedTextbook) setTextbook(openedTextbook)
    } catch {
      setError("The textbook could not be opened.")
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b bg-background/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <img alt="" className="size-10 rounded-[10px]" src={pdfantomLogo} />
          <div>
            <p className="m-0 text-[0.72rem] font-bold tracking-[0.13em] text-muted-foreground uppercase">
              PDFantom
            </p>
            <h1 className="m-0 text-[1.05rem] font-semibold">Textbook reader</h1>
          </div>
        </div>
        <Button className="rounded-full px-4" type="button" onClick={openTextbook}>
          Open textbook
        </Button>
      </header>

      {error && (
        <p className="mx-auto my-8 max-w-152 text-center text-destructive" role="alert">
          {error}
        </p>
      )}

      {textbook ? (
        <TextbookReader textbook={textbook} />
      ) : (
        <section className="mx-auto mt-[14vh] max-w-lg text-center">
          <img
            alt=""
            aria-hidden="true"
            className="mx-auto mb-6 size-28 rounded-[28px]"
            src={pdfantomLogo}
          />
          <h2 className="text-2xl font-semibold tracking-tight">Open a textbook to begin</h2>
          <p className="mt-2 text-muted-foreground">
            Reading local PDFs does not require a model provider.
          </p>
        </section>
      )}
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
