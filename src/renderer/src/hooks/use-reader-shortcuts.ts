import { useEffect } from "react"

import { useReaderSession } from "../store/reader-session-provider"

export function useReaderShortcuts() {
  const currentPage = useReaderSession((state) => state.currentPage)
  const pageView = useReaderSession((state) => state.pageView)
  const requestPage = useReaderSession((state) => state.requestPage)
  const interactive = useReaderSession((state) => state.interactive)
  useEffect(() => {
    const navigateWithArrowKey = (event: globalThis.KeyboardEvent) => {
      if (
        !interactive ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof Element) ||
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return
      }

      const pagesPerView = pageView === "double" ? 2 : 1
      const viewStartPage = currentPage - ((currentPage - 1) % pagesPerView)

      if (event.key === "ArrowLeft") {
        requestPage(viewStartPage - pagesPerView)
      } else if (event.key === "ArrowRight") {
        requestPage(viewStartPage + pagesPerView)
      } else {
        return
      }

      event.preventDefault()
    }

    window.addEventListener("keydown", navigateWithArrowKey)
    return () => window.removeEventListener("keydown", navigateWithArrowKey)
  }, [currentPage, pageView, requestPage, interactive])
}
