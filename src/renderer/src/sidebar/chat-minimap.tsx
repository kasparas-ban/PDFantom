import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { useAuiState } from "@assistant-ui/react"

import { cn } from "@/lib/utils"
import {
  CHAT_MINIMAP_MINIMUM_TURNS,
  resolveChatMinimapIndexFromPointer,
  resolveChatMinimapItemTopPercent,
  resolveChatMinimapPreview,
  resolveChatMinimapPreviewTranslate,
  resolveChatMinimapTurnIds,
} from "./chat-minimap-layout"

const MESSAGE_ID_ATTRIBUTE = "data-message-id"
const TURN_ID_SEPARATOR = " "
const DASH_SPACING = 8

const findMessageElement = (viewport: HTMLElement, id: string) =>
  viewport.querySelector(`[${MESSAGE_ID_ATTRIBUTE}="${CSS.escape(id)}"]`)

type ChatMinimapProps = {
  readonly viewportElement: HTMLElement | null
}

export function ChatMinimap({ viewportElement }: ChatMinimapProps) {
  const turnIds = useChatMinimapTurnIds()
  const messagesInView = useMessagesInView(viewportElement, turnIds)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const active =
    activeIndex !== null && activeIndex < turnIds.length
      ? { id: turnIds[activeIndex], index: activeIndex }
      : null
  const preview = useChatMinimapPreview(active?.id ?? null)

  if (turnIds.length < CHAT_MINIMAP_MINIMUM_TURNS) return null

  const activeLabel = preview?.userText ?? "User message"

  const resolveIndexFromPointer = (event: MouseEvent<HTMLElement>) => {
    const rail = event.currentTarget.getBoundingClientRect()

    return resolveChatMinimapIndexFromPointer({
      itemCount: turnIds.length,
      pointerY: event.clientY,
      railHeight: rail.height,
      railTop: rail.top,
    })
  }

  const jumpTo = (id: string) => {
    if (!viewportElement) return

    findMessageElement(viewportElement, id)?.scrollIntoView({ block: "start" })
  }

  const moveActiveIndex = (delta: number) =>
    setActiveIndex((current) => Math.max(0, Math.min(turnIds.length - 1, (current ?? 0) + delta)))

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden opacity-0 transition-opacity duration-150 select-none focus-within:opacity-100 hover:opacity-100 @min-[834px]:opacity-100 [@media(pointer:fine)]:block"
      data-slot="chat-minimap"
    >
      <button
        aria-label={`Jump to message: ${activeLabel}`}
        className="pointer-events-auto absolute top-1/2 left-1 w-[clamp(12px,calc(12px+(100cqw-762px)/2),40px)] -translate-y-1/2 cursor-pointer bg-transparent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        onBlur={() => setActiveIndex(null)}
        onClick={(event) => jumpTo(turnIds[resolveIndexFromPointer(event)])}
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
              setActiveIndex(turnIds.length - 1)
              break
            case "Enter":
            case " ":
              event.preventDefault()
              if (active) jumpTo(active.id)
              break
          }
        }}
        onMouseDown={(event) => event.preventDefault()}
        onMouseLeave={() => setActiveIndex(null)}
        onMouseMove={(event) => setActiveIndex(resolveIndexFromPointer(event))}
        style={{ height: `min(${(turnIds.length - 1) * DASH_SPACING}px, calc(100% - 16rem))` }}
        type="button"
      >
        <span aria-hidden="true" className="absolute top-0 left-2 h-full w-px bg-border/15" />

        {turnIds.map((id, index) => (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-0 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/35 transition-[background-color,width] duration-150 data-[in-view=true]:bg-foreground/90",
              resolveDashWidthClass(active?.index ?? null, index),
            )}
            data-in-view={messagesInView.has(id)}
            key={id}
            style={{ top: `${resolveChatMinimapItemTopPercent(index, turnIds.length)}%` }}
          />
        ))}

        {active && preview ? (
          <span
            className="pointer-events-none absolute left-6 block w-[min(320px,calc(100cqw-36px))] rounded-lg bg-popover p-3 text-left text-popover-foreground shadow-md ring-1 ring-foreground/10"
            data-slot="chat-minimap-preview"
            style={{
              top: `${resolveChatMinimapItemTopPercent(active.index, turnIds.length)}%`,
              transform: `translateY(${resolveChatMinimapPreviewTranslate(active.index, turnIds.length)})`,
            }}
          >
            <span className="block truncate text-sm/5 font-medium">{activeLabel}</span>
            {preview.assistantText ? (
              <span className="mt-1 line-clamp-3 text-sm/5 text-muted-foreground">
                {preview.assistantText}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
    </div>
  )
}

function useChatMinimapTurnIds() {
  const turnKey = useAuiState((state) =>
    resolveChatMinimapTurnIds(state.thread.messages).join(TURN_ID_SEPARATOR),
  )

  return useMemo(() => (turnKey === "" ? [] : turnKey.split(TURN_ID_SEPARATOR)), [turnKey])
}

function useChatMinimapPreview(turnId: string | null) {
  const messages = useAuiState((state) => state.thread.messages)

  return useMemo(
    () => (turnId === null ? null : resolveChatMinimapPreview(messages, turnId)),
    [messages, turnId],
  )
}

function useMessagesInView(viewportElement: HTMLElement | null, turnIds: readonly string[]) {
  const [messagesInView, setMessagesInView] = useState<ReadonlySet<string>>(new Set())

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

          return next
        })
      },
      { root: viewportElement },
    )

    for (const id of turnIds) {
      const element = findMessageElement(viewportElement, id)
      if (element) observer.observe(element)
    }

    return () => observer.disconnect()
  }, [turnIds, viewportElement])

  return messagesInView
}

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
