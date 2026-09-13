import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react"

type SearchShortcutOptions = {
  readonly getFallbackFocus: () => HTMLElement | null
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly isInScope: (element: Element) => boolean
  readonly onClose: () => void
  readonly onOpen: () => void
  readonly visible: boolean
}

export function useSearchShortcut({
  getFallbackFocus,
  inputRef,
  isInScope,
  onClose,
  onOpen,
  visible,
}: SearchShortcutOptions) {
  const opener = useRef<HTMLElement | null>(null)
  const scopeIsActive = useRef(false)

  const close = useCallback(() => {
    const previousOpener = opener.current
    const focusTarget = previousOpener?.isConnected ? previousOpener : getFallbackFocus()

    onClose()
    opener.current = null

    requestAnimationFrame(() => {
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true })
    })
  }, [getFallbackFocus, onClose])

  useEffect(() => {
    const updateActiveScope = (event: Event) => {
      const target = event.target
      scopeIsActive.current = target instanceof Element && isInScope(target)
    }

    window.addEventListener("focusin", updateActiveScope)
    window.addEventListener("pointerdown", updateActiveScope, true)

    return () => {
      scopeIsActive.current = false
      window.removeEventListener("focusin", updateActiveScope)
      window.removeEventListener("pointerdown", updateActiveScope, true)
    }
  }, [isInScope])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const focused = document.activeElement

      if (event.key === "Escape" && visible) {
        if (focused instanceof Element && inputRef.current?.closest("search")?.contains(focused)) {
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

      const focusIsInScope = focused instanceof Element && isInScope(focused)
      if (!focusIsInScope && !scopeIsActive.current) return

      event.preventDefault()

      if (visible) {
        inputRef.current?.focus()
        inputRef.current?.select()
        return
      }

      opener.current =
        focusIsInScope && focused instanceof HTMLElement ? focused : getFallbackFocus()
      onOpen()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [close, getFallbackFocus, inputRef, isInScope, onOpen, visible])

  useLayoutEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [inputRef, visible])

  return close
}
