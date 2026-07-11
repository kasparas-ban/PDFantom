import { BookOpen, FilePlus2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAppConfig } from "@/store/app-config-provider"
import pdfantomLogo from "../../../../assets/pdfantom-logo.svg?no-inline"

type AppSidebarProps = {
  readonly onOpenDocument: () => void
}

export function AppSidebar({ onOpenDocument }: AppSidebarProps) {
  const activePDF = useAppConfig((state) => state.activePDF)

  return (
    <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_-1px_0_rgb(255_255_255/28%)]">
      <div aria-label="Window drag area" className="window-drag-region h-12 shrink-0" />

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        <div className="mb-3 flex items-center gap-2 px-1">
          <img alt="" className="size-8 rounded-md" src={pdfantomLogo} />
          <h1 className="font-semibold">PDFantom</h1>
        </div>

        <nav aria-label="Primary" className="space-y-0.5 font-semibold text-gray-600">
          <Button
            className="w-full justify-start gap-2 px-2 hover:bg-sidebar-accent"
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
          {activePDF ? (
            <div
              aria-current="page"
              className="flex w-full items-center gap-2 rounded-lg bg-sidebar-accent px-2 py-1.5 text-left text-sm text-sidebar-accent-foreground"
            >
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{activePDF.name}</span>
            </div>
          ) : (
            <div className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
              Open a PDF to begin reading.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
