import type { ThreadMessage } from "@assistant-ui/react"

/** One dash on the minimap: a Student turn and the reply it drew. */
export type ChatMinimapItem = {
  readonly id: string
  readonly userText: string | null
  readonly assistantText: string | null
}

/** A lone dash maps nothing, so the minimap stays hidden until there are two. */
export const CHAT_MINIMAP_MINIMUM_ITEMS = 2

const ITEM_SPACING = 8
const MAXIMUM_RAIL_HEIGHT = "calc(100% - 16rem)"

/**
 * Every streamed chunk produces a fresh message list, so the items are rebuilt
 * continuously while a Model replies. The preview shows four lines at most, so
 * reading past that would cost the whole Conversation's text on every chunk.
 */
const PREVIEW_TEXT_LIMIT = 240

export function deriveChatMinimapItems(messages: readonly ThreadMessage[]) {
  const items: ChatMinimapItem[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role !== "user") continue

    items.push({
      id: message.id,
      userText: compactPreview(resolveMessageText(message)),
      assistantText: compactPreview(resolveFinalAssistantText(messages, index)),
    })
  }

  return items
}

function resolveMessageText(message: ThreadMessage) {
  let text = ""

  for (const part of message.content) {
    if (part.type !== "text") continue

    text += part.text
    if (text.length >= PREVIEW_TEXT_LIMIT) break
  }

  return text.slice(0, PREVIEW_TEXT_LIMIT)
}

/**
 * The dash previews the turn's outcome, which is the last Assistant Message
 * before the Student speaks again — intermediate replies are superseded.
 */
function resolveFinalAssistantText(messages: readonly ThreadMessage[], userIndex: number) {
  let text: string | null = null

  for (let index = userIndex + 1; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role === "user") break
    if (message.role === "assistant") text = resolveMessageText(message)
  }

  return text
}

function compactPreview(text: string | null) {
  const compact = text?.replace(/\s+/gu, " ").trim() ?? ""

  return compact.length > 0 ? compact : null
}

export function resolveChatMinimapRailHeight(itemCount: number) {
  const naturalHeight = Math.max(1, (itemCount - 1) * ITEM_SPACING)

  return `max(1px, min(${naturalHeight}px, ${MAXIMUM_RAIL_HEIGHT}))`
}

export function resolveChatMinimapItemTopPercent(index: number, itemCount: number) {
  if (itemCount <= 1) return 0

  return (Math.max(0, Math.min(index, itemCount - 1)) / (itemCount - 1)) * 100
}

export function resolveChatMinimapIndexFromPointer(input: {
  readonly itemCount: number
  readonly pointerY: number
  readonly railHeight: number
  readonly railTop: number
}) {
  if (input.itemCount <= 0 || input.railHeight <= 0) return null
  if (input.itemCount === 1) return 0

  const progress = Math.max(0, Math.min(1, (input.pointerY - input.railTop) / input.railHeight))

  return Math.max(0, Math.min(input.itemCount - 1, Math.round(progress * (input.itemCount - 1))))
}

/** Keep the preview inside the viewport when its dash sits at either end. */
export function resolveChatMinimapPreviewTranslate(index: number, itemCount: number) {
  if (index <= 0) return "0%"
  if (index >= itemCount - 1) return "-100%"

  return "-50%"
}

// The minimap overlays the Conversation's left edge instead of reserving a lane
// of its own, so its geometry is derived from the message column: `px-4` on the
// viewport plus whatever the centred `max-w-182.5` column leaves beside it, less
// the resize handle that straddles the panel's left edge.
const CONTENT_MAXIMUM_WIDTH = 730
const CONTENT_PADDING = 16
const RESIZE_HANDLE_INSET = 4

const PERSISTENT_LANE_WIDTH = 48
const MAXIMUM_HIT_STRIP_WIDTH = 40

/** `left-1` on the rail, then `left-6` on the preview within it. */
const RAIL_INSET = 4
const PREVIEW_INSET = 24
const PREVIEW_MARGIN = 8
const MAXIMUM_PREVIEW_WIDTH = 320

/**
 * Everything the rail takes from the panel's width, which is the clear space
 * between the panel's left edge and the message column.
 *
 * `hitStripWidth` is capped to that lane so the strip never overlays the column
 * and swallows its pointer events; 0 leaves the minimap inert. A wide panel
 * leaves the dashes enough room to read as part of the layout, so the rail stays
 * visible; a narrow one keeps it out of sight until the pointer asks for it.
 */
export function resolveChatMinimapLane(viewportWidth: number) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return { hitStripWidth: 0, isPersistent: false, previewWidth: 0 }
  }

  const innerWidth = Math.max(0, viewportWidth - 2 * CONTENT_PADDING)
  const columnGutter = Math.max(0, (innerWidth - CONTENT_MAXIMUM_WIDTH) / 2)
  const laneWidth = Math.max(0, CONTENT_PADDING + columnGutter - RESIZE_HANDLE_INSET)
  const previewSpace = viewportWidth - RAIL_INSET - PREVIEW_INSET - PREVIEW_MARGIN

  return {
    hitStripWidth: Math.min(MAXIMUM_HIT_STRIP_WIDTH, Math.floor(laneWidth)),
    isPersistent: laneWidth >= PERSISTENT_LANE_WIDTH,
    previewWidth: Math.max(0, Math.min(MAXIMUM_PREVIEW_WIDTH, previewSpace)),
  }
}
