import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs"

type RenderingQueue = Pick<
  NonNullable<PDFViewer["renderingQueue"]>,
  "renderHighestPriority" | "renderView"
>

export function installPDFRenderingGate(owner: { renderingQueue?: RenderingQueue }) {
  const queue = owner.renderingQueue
  if (!queue) throw new Error("PDF.js did not provide a rendering queue.")

  const renderHighestPriority = queue.renderHighestPriority
  const renderView = queue.renderView
  let active = true

  const gatedRenderHighestPriority: RenderingQueue["renderHighestPriority"] = (visible) => {
    if (active) renderHighestPriority.call(queue, visible)
  }
  const gatedRenderView: RenderingQueue["renderView"] = (view) =>
    active ? renderView.call(queue, view) : false

  queue.renderHighestPriority = gatedRenderHighestPriority
  queue.renderView = gatedRenderView

  return {
    setActive: (next: boolean) => {
      active = next
    },
    dispose: () => {
      if (queue.renderHighestPriority === gatedRenderHighestPriority) {
        queue.renderHighestPriority = renderHighestPriority
      }
      if (queue.renderView === gatedRenderView) queue.renderView = renderView
    },
  }
}
