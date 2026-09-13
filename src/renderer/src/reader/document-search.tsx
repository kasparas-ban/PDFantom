import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { EMPTY_DOCUMENT_SEARCH, type ReaderWorkspace } from "./reader-workspace"

const subscribeToNothing = () => () => {}
const getEmptySearch = () => EMPTY_DOCUMENT_SEARCH

export function useDocumentSearchSnapshot(workspace: ReaderWorkspace | null) {
  return useSyncExternalStore(
    workspace?.subscribeSearch ?? subscribeToNothing,
    workspace?.getSearchSnapshot ?? getEmptySearch,
  )
}

export function DocumentSearch({ workspace }: { workspace: ReaderWorkspace | null }) {
  const search = useDocumentSearchSnapshot(workspace)
  const input = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    const previousOpener = opener.current
    workspace?.closeSearch()

    opener.current = null
    requestAnimationFrame(() => {
      const focusTarget = previousOpener?.isConnected
        ? previousOpener
        : document.querySelector<HTMLElement>(
            '[data-presented="true"] [data-slot="reader-scroll"]',
          )
      focusTarget?.focus({ preventScroll: true })
    })
  }, [workspace])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape" && search.visible) {
        const focused = document.activeElement
        if (focused instanceof HTMLElement && focused.closest('[data-slot="document-search"]')) {
          event.preventDefault()
          close()
        }

        return
      }

      if (
        event.defaultPrevented ||
        event.key.toLowerCase() !== "f" ||
        !event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return
      }

      const focused = document.activeElement
      if (
        !(focused instanceof HTMLElement) ||
        !focused.closest('[data-slot="reader-scroll"], [data-slot="reader-toolbar"]')
      ) {
        return
      }

      event.preventDefault()

      if (search.visible) {
        input.current?.focus()
        input.current?.select()
        return
      }

      opener.current = focused
      workspace?.openSearch()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [close, search.visible, workspace])

  useLayoutEffect(() => {
    if (search.visible) input.current?.focus()
  }, [search.visible])

  if (!search.visible) return null

  let count = ""
  let announcement = ""

  if (search.query) {
    count = search.phase === "searching" ? "Searching…" : `${search.current} / ${search.total}`
  }

  if (search.phase === "searching") {
    announcement = "Searching"
  } else if (search.phase === "not-found") {
    announcement = "No matches"
  } else if (search.wrapped) announcement = "Search wrapped"

  const navigate = (previous: boolean) => workspace?.moveSearch(previous)

  return (
    <search
      aria-label="Document search"
      className="window-no-drag absolute top-full right-3 z-30 mt-2 flex w-97.5 max-w-[calc(100%-1.5rem)]"
      data-search-visible="true"
      data-slot="document-search"
    >
      <div className="flex w-full items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
        <Input
          aria-label="Search document"
          autoComplete="off"
          className="h-7 min-w-24 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => workspace?.updateSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return

            event.preventDefault()
            navigate(event.shiftKey)
          }}
          ref={input}
          type="search"
          value={search.query}
        />
        <output
          aria-label="Search match count"
          className="min-w-16 text-center text-xs whitespace-nowrap text-muted-foreground"
        >
          {count}
        </output>
        <Separator aria-hidden="true" className="mx-1 bg-border/60" orientation="vertical" />
        <Button
          aria-label="Previous match"
          disabled={!search.current}
          onClick={() => navigate(true)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronUp />
        </Button>
        <Button
          aria-label="Next match"
          disabled={!search.current}
          onClick={() => navigate(false)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronDown />
        </Button>
        <Button
          aria-label="Close search"
          onClick={close}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
      </div>
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
    </search>
  )
}
