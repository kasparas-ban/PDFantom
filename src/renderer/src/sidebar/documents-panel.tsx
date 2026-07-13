import { Book, FilePlus2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useReaderSession } from "@/store/reader-session-provider"
import pdfantomLogo from "../../../../assets/pdfantom-logo.svg?no-inline"

type DocumentsPanelProps = {
  readonly onActivateDocument: (documentId: string) => void
  readonly onOpenDocument: () => void
}

export function DocumentsPanel({ onActivateDocument, onOpenDocument }: DocumentsPanelProps) {
  const activeDocument = useReaderSession((state) => state.activeDocument)
  const documents = useReaderSession((state) => state.documents)
  const isDocumentLibraryHydrated = useReaderSession((state) => state.isDocumentLibraryHydrated)

  return (
    <aside
      aria-label="Documents panel"
      className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_-1px_0_rgb(255_255_255/28%)]"
      id="documents-panel"
    >
      <div aria-label="Window drag area" className="window-drag-region h-12 shrink-0" />

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="mb-3 flex items-center gap-2 px-1">
          <img alt="" className="size-8 rounded-md" src={pdfantomLogo} />
          <h1 className="font-semibold">PDFantom</h1>
        </div>

        <nav aria-label="Primary" className="space-y-0.5 font-semibold text-gray-600">
          <Button
            className="w-full justify-start gap-2 px-2 hover:bg-sidebar-accent"
            disabled={!isDocumentLibraryHydrated}
            onClick={onOpenDocument}
            type="button"
            variant="ghost"
          >
            <FilePlus2 />
            Open PDF
          </Button>
        </nav>

        <div className="mt-6 min-h-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <p className="text-md font-semibold text-gray-400">Documents</p>
          </div>
          {documents.length > 0 ? (
            <nav aria-label="Documents" className="space-y-0.5">
              {documents.map((document) => {
                const isActive =
                  activeDocument.status !== "none" && activeDocument.document.id === document.id

                return (
                  <Button
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "w-full justify-start gap-2 px-2 font-normal hover:bg-sidebar-accent",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                    key={document.id}
                    onClick={() => onActivateDocument(document.id)}
                    title={document.name}
                    type="button"
                    variant="ghost"
                  >
                    <Book className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left">{document.name}</span>
                  </Button>
                )
              })}
            </nav>
          ) : (
            <div className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
              {isDocumentLibraryHydrated ? "Open a PDF to begin reading." : "Loading documents…"}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
