import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react"

import { SearchBar } from "@/components/search-bar"
import { useSearchShortcut } from "@/hooks/use-search-shortcut"
import { createChatSearchController } from "./chat-search-runtime"
import { useChatPanelMode, useChatThreads } from "./chat-session"
import type { ChatPanelMode } from "./chat-thread-store"

export function ChatSearch({ viewportElement }: { viewportElement: HTMLElement | null }) {
  const mode = useChatPanelMode()
  const targetId = useChatThreads((state) =>
    mode === "main" ? (state.active?.threadId ?? null) : (state.activeSideChat?.threadId ?? null),
  )
  const controller = useMemo(() => createChatSearchController(mode), [mode])
  const search = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const input = useRef<HTMLInputElement>(null)
  const previousTargetId = useRef(targetId)
  const panel = viewportElement?.closest("aside") ?? null
  const getFallbackFocus = useCallback(
    () => panel?.querySelector<HTMLElement>("textarea") ?? panel,
    [panel],
  )
  const isInScope = useCallback(
    (element: Element) => panel !== null && element.closest("aside") === panel,
    [panel],
  )
  const close = useSearchShortcut({
    getFallbackFocus,
    inputRef: input,
    isInScope,
    onClose: controller.close,
    onOpen: controller.open,
    visible: search.visible,
  })

  useLayoutEffect(() => {
    if (!viewportElement) return

    return controller.connect(viewportElement)
  }, [controller, viewportElement])

  useLayoutEffect(() => {
    if (previousTargetId.current === targetId) return

    previousTargetId.current = targetId
    controller.reset()
  }, [controller, targetId])

  if (!search.visible) return null

  return (
    <>
      <ChatSearchHighlightStyles mode={mode} />
      <SearchBar
        ariaLabel="Chat search"
        className="absolute top-2 right-3 z-30 flex w-97.5 max-w-[calc(100%-1.5rem)]"
        inputLabel="Search chat"
        inputRef={input}
        onClose={close}
        onMove={controller.move}
        onQueryChange={controller.update}
        search={search}
        slot="chat-search"
      />
    </>
  )
}

function ChatSearchHighlightStyles({ mode }: { readonly mode: ChatPanelMode }) {
  return (
    <style>{`
      ::highlight(pdfantom-chat-search-${mode}) {
        background-color: rgb(250 204 21 / 0.38);
      }

      ::highlight(pdfantom-chat-search-${mode}-current) {
        background-color: rgb(249 115 22 / 0.58);
      }

      .dark ::highlight(pdfantom-chat-search-${mode}) {
        background-color: rgb(250 204 21 / 0.3);
      }

      .dark ::highlight(pdfantom-chat-search-${mode}-current) {
        background-color: rgb(251 146 60 / 0.62);
      }
    `}</style>
  )
}
