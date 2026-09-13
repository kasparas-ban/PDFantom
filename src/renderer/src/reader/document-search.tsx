import { useCallback, useRef, useSyncExternalStore } from "react"

import { SearchBar } from "@/components/search-bar"
import { useSearchShortcut } from "@/hooks/use-search-shortcut"
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
  const getFallbackFocus = useCallback(
    () =>
      document.querySelector<HTMLElement>('[data-presented="true"] [data-slot="reader-scroll"]'),
    [],
  )
  const isInScope = useCallback(
    (element: Element) =>
      Boolean(element.closest('[data-slot="reader-scroll"], [data-slot="reader-toolbar"]')),
    [],
  )
  const open = useCallback(() => workspace?.openSearch(), [workspace])
  const closeSearch = useCallback(() => workspace?.closeSearch(), [workspace])
  const close = useSearchShortcut({
    getFallbackFocus,
    inputRef: input,
    isInScope,
    onClose: closeSearch,
    onOpen: open,
    visible: search.visible,
  })

  if (!search.visible) return null

  return (
    <SearchBar
      ariaLabel="Document search"
      className="absolute top-full right-3 z-30 mt-2 flex w-97.5 max-w-[calc(100%-1.5rem)]"
      inputLabel="Search document"
      inputRef={input}
      onClose={close}
      onMove={(previous) => workspace?.moveSearch(previous)}
      onQueryChange={(query) => workspace?.updateSearch(query)}
      search={search}
      slot="document-search"
    />
  )
}
