const MESSAGE_SELECTOR = "[data-message-id]"
const NOT_SELECTABLE_SELECTOR = '[data-chat-quote-selectable="false"]'

export type ChatTextSelection = {
  readonly text: string
  readonly messageId: string
  readonly rect: DOMRect
}

export function readChatTextSelection(viewportElement: HTMLElement): ChatTextSelection | null {
  const current = window.getSelection()
  if (!current || current.isCollapsed || current.rangeCount === 0) return null

  const text = current.toString().trim()
  if (!text) return null

  const messageId = resolveSelectionMessageId(current, viewportElement)
  if (!messageId) return null

  return { text, messageId, rect: current.getRangeAt(0).getBoundingClientRect() }
}

function resolveSelectionMessageId(selection: Selection, viewportElement: HTMLElement) {
  const anchor = toElement(selection.anchorNode)
  const focus = toElement(selection.focusNode)
  if (!anchor || !focus) return null

  const message = anchor.closest(MESSAGE_SELECTOR)
  if (!message || message !== focus.closest(MESSAGE_SELECTOR)) return null
  if (!viewportElement.contains(message)) return null
  if (isExcluded(anchor, message) || isExcluded(focus, message)) return null

  return message.getAttribute("data-message-id")
}

function isExcluded(element: Element, message: Element) {
  const marker = element.closest(NOT_SELECTABLE_SELECTOR)

  return marker !== null && message.contains(marker)
}

function toElement(node: Node | null) {
  return node instanceof Element ? node : (node?.parentElement ?? null)
}
