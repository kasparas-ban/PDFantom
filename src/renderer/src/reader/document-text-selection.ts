const BOUNDS_SELECTOR = '[data-presented="true"] [data-slot="reader-scroll"]'

export type DocumentTextSelection = {
  readonly text: string
  readonly firstPage: number
  readonly lastPage: number
  readonly rect: DOMRect
  readonly boundsRect: DOMRect
}

export function normalizeDocumentSelectionText(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function readDocumentTextSelection(hostElement: HTMLElement): DocumentTextSelection | null {
  const current = window.getSelection()
  if (!current || current.isCollapsed || current.rangeCount === 0) return null

  const boundsElement = hostElement.querySelector(BOUNDS_SELECTOR)
  if (!boundsElement) return null

  const anchorPage = pageOf(current.anchorNode, boundsElement)
  const focusPage = pageOf(current.focusNode, boundsElement)
  if (!anchorPage || !focusPage) return null

  const text = normalizeDocumentSelectionText(current.toString())
  if (!text) return null

  return {
    text,
    firstPage: Math.min(anchorPage, focusPage),
    lastPage: Math.max(anchorPage, focusPage),
    rect: current.getRangeAt(0).getBoundingClientRect(),
    boundsRect: boundsElement.getBoundingClientRect(),
  }
}

function pageOf(node: Node | null, boundsElement: Element) {
  const element = node instanceof Element ? node : node?.parentElement
  const textLayer = element?.closest(".textLayer")
  if (!textLayer || !boundsElement.contains(textLayer)) return null

  const page = Number(textLayer.closest(".page")?.getAttribute("data-page-number"))

  return Number.isInteger(page) && page >= 1 ? page : null
}
