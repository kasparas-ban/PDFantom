import { MINIMUM_PANEL_WIDTH } from "../reader-workspace-layout"
import { DocumentsPanel } from "./documents-panel"
import { ResizablePanel } from "./resizable-panel"

type ResizableDocumentsPanelProps = {
  readonly maximumWidth: number
  readonly onActivateDocument: (documentId: string) => void
  readonly onOpenDocument: () => void
  readonly onWidthChange: (width: number) => void
  readonly width: number
}

export function ResizableDocumentsPanel({
  maximumWidth,
  onActivateDocument,
  onOpenDocument,
  onWidthChange,
  width,
}: ResizableDocumentsPanelProps) {
  return (
    <ResizablePanel
      maximumWidth={maximumWidth}
      minimumWidth={MINIMUM_PANEL_WIDTH}
      onWidthChange={onWidthChange}
      resizeHandleLabel="Resize documents panel"
      side="left"
      width={width}
    >
      <DocumentsPanel
        onActivateDocument={onActivateDocument}
        onOpenDocument={onOpenDocument}
      />
    </ResizablePanel>
  )
}
