import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { useAuiState } from "@assistant-ui/react"

import { cn } from "@/lib/utils"
import {
  CHAT_MINIMAP_MINIMUM_ITEMS,
  deriveChatMinimapItems,
  resolveChatMinimapIndexFromPointer,
  resolveChatMinimapItemTopPercent,
  resolveChatMinimapLane,
  resolveChatMinimapPreviewTranslate,
  resolveChatMinimapRailHeight,
  type ChatMinimapItem,
} from "./chat-minimap-layout"

/**
 * The minimap finds its messages through the DOM rather than through a
 * registry every message pushes itself into: it already reads their geometry
 * to place the dashes and scrolls the viewport to reach them. `UserMessage`
 * carries the matching `data-message-id`.
 */
const MESSAGE_ID_ATTRIBUTE = "data-message-id"

const findMessageElement = (viewport: HTMLElement, id: string) =>
  viewport.querySelector(`[${MESSAGE_ID_ATTRIBUTE}="${CSS.escape(id)}"]`)

const sameMembers = (left: ReadonlySet<string>, right: ReadonlySet<string>) =>
  left.size === right.size && [...left].every((id) => right.has(id))

type ChatMinimapProps = {
  readonly viewportElement: HTMLElement | null
}

/**
 * A rail of dashes down the Conversation's left edge, one per Student turn.
 * Hovering it previews a turn and clicking jumps to it; dashes for messages on
 * screen are drawn brighter, so the rail doubles as a position indicator.
 */
export function ChatMinimap({ viewportElement }: ChatMinimapProps) {
  const messages = useAuiState((state) => state.thread.messages)
  const items = useMemo(() => deriveChatMinimapItems(messages), [messages])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [messagesInView, setMessagesInView] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!viewportElement) return

    const measure = () => setViewportWidth(viewportElement.getBoundingClientRect().width)

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(viewportElement)

    return () => observer.disconnect()
  }, [viewportElement])

  useEffect(() => {
    if (!viewportElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        setMessagesInView((inView) => {
          const next = new Set(inView)

          for (const entry of entries) {
            const id = entry.target.getAttribute(MESSAGE_ID_ATTRIBUTE)
            if (id === null) continue

            if (entry.isIntersecting) {
              next.add(id)
            } else {
              next.delete(id)
            }
          }

          // A new Model chunk rebuilds the items and so re-observes every
          // message, and a fresh observer reports them all back. Holding the
          // old set keeps that from re-rendering the rail on every chunk.
          return sameMembers(inView, next) ? inView : next
        })
      },
      { root: viewportElement },
    )

    for (const item of items) {
      const element = findMessageElement(viewportElement, item.id)
      if (element) observer.observe(element)
    }

    return () => observer.disconnect()
  }, [items, viewportElement])

  if (items.length < CHAT_MINIMAP_MINIMUM_ITEMS) return null

  const lane = resolveChatMinimapLane(viewportWidth)
  const activeIndexInRange = activeIndex !== null && activeIndex < items.length ? activeIndex : null
  const activeItem = activeIndexInRange === null ? null : items[activeIndexInRange]
  const activeLabel = activeItem?.userText ?? "User message"
  const activeTopPercent =
    activeIndexInRange === null
      ? 0
      : resolveChatMinimapItemTopPercent(activeIndexInRange, items.length)
  const activeTranslate =
    activeIndexInRange === null
      ? "-50%"
      : resolveChatMinimapPreviewTranslate(activeIndexInRange, items.length)

  const resolveIndexFromPointer = (event: MouseEvent<HTMLElement>) => {
    const rail = event.currentTarget.getBoundingClientRect()

    return resolveChatMinimapIndexFromPointer({
      itemCount: items.length,
      pointerY: event.clientY,
      railHeight: rail.height,
      railTop: rail.top,
    })
  }

  const jumpTo = (item: ChatMinimapItem) => {
    if (!viewportElement) return

    findMessageElement(viewportElement, item.id)?.scrollIntoView({ block: "start" })
  }

  const moveActiveIndex = (delta: number) =>
    setActiveIndex((current) => Math.max(0, Math.min(items.length - 1, (current ?? 0) + delta)))

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 z-20 hidden select-none [@media(pointer:fine)]:block",
        lane.isPersistent
          ? "opacity-100"
          : "opacity-0 transition-opacity duration-150 focus-within:opacity-100 hover:opacity-100",
      )}
      data-slot="chat-minimap"
    >
      <button
        aria-label={`Jump to message: ${activeLabel}`}
        className={cn(
          "absolute top-1/2 left-1 -translate-y-1/2 cursor-pointer bg-transparent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
          // With no lane to sit in the strip would overlay the message column
          // and swallow its pointer events, so it goes inert instead.
          lane.hitStripWidth > 0 ? "pointer-events-auto" : "pointer-events-none",
        )}
        onBlur={() => setActiveIndex(null)}
        onClick={(event) => {
          const index = resolveIndexFromPointer(event)
          if (index !== null) jumpTo(items[index])
        }}
        onFocus={() => setActiveIndex((current) => current ?? 0)}
        onKeyDown={(event) => {
          switch (event.key) {
            case "ArrowDown":
              event.preventDefault()
              moveActiveIndex(1)
              break
            case "ArrowUp":
              event.preventDefault()
              moveActiveIndex(-1)
              break
            case "Home":
              event.preventDefault()
              setActiveIndex(0)
              break
            case "End":
              event.preventDefault()
              setActiveIndex(items.length - 1)
              break
            case "Enter":
            case " ":
              event.preventDefault()
              if (activeItem) jumpTo(activeItem)
              break
          }
        }}
        // Aiming the rail should neither focus it nor start selecting the
        // message text the strip sits against.
        onMouseDown={(event) => event.preventDefault()}
        onMouseLeave={() => setActiveIndex(null)}
        onMouseMove={(event) => setActiveIndex(resolveIndexFromPointer(event))}
        style={{
          height: resolveChatMinimapRailHeight(items.length),
          width: lane.hitStripWidth,
        }}
        type="button"
      >
        <span aria-hidden="true" className="absolute top-0 left-2 h-full w-px bg-border/15" />

        {items.map((item, index) => (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-0 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/35 transition-[background-color,width] duration-150 data-[in-view=true]:bg-foreground/90",
              resolveDashWidthClass(activeIndexInRange, index),
            )}
            data-in-view={messagesInView.has(item.id)}
            key={item.id}
            style={{ top: `${resolveChatMinimapItemTopPercent(index, items.length)}%` }}
          />
        ))}

        {activeItem ? (
          <span
            // Inert, so aiming the rail is never disturbed by the preview
            // that opens over the message column beside it.
            className="pointer-events-none absolute left-6 block rounded-lg bg-popover p-3 text-left text-popover-foreground shadow-md ring-1 ring-foreground/10"
            data-slot="chat-minimap-preview"
            style={{
              top: `${activeTopPercent}%`,
              transform: `translateY(${activeTranslate})`,
              width: lane.previewWidth,
            }}
          >
            <span className="block truncate text-sm/5 font-medium">{activeLabel}</span>
            {activeItem.assistantText ? (
              <span className="mt-1 line-clamp-3 text-sm/5 text-muted-foreground">
                {activeItem.assistantText}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    </div>
  )
}

/** The rail tapers away from the pointer, so the aimed-at turn reads clearly. */
function resolveDashWidthClass(activeIndex: number | null, index: number) {
  if (activeIndex === null) return "w-2"

  switch (Math.abs(index - activeIndex)) {
    case 0:
      return "w-6 bg-muted-foreground/75"
    case 1:
      return "w-4"
    case 2:
      return "w-2.5"
    default:
      return "w-2"
  }
}
