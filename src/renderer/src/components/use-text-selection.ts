import { useEffect, useState } from "react"

export function useTextSelection<T>(
  element: HTMLElement | null,
  read: (element: HTMLElement) => T | null,
) {
  const [selection, setSelection] = useState<T | null>(null)

  useEffect(() => {
    if (!element) return

    let frame = 0

    const readNow = () => {
      frame = 0
      setSelection(read(element))
    }

    const scheduleRead = () => {
      if (frame === 0) frame = requestAnimationFrame(readNow)
    }

    const handleSelectionChange = () => {
      const current = window.getSelection()
      if (!current || current.isCollapsed) setSelection(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (isTextField(event.target)) setSelection(null)
    }

    element.addEventListener("mouseup", scheduleRead)
    element.addEventListener("keyup", scheduleRead)
    element.addEventListener("scroll", scheduleRead, { capture: true, passive: true })
    window.addEventListener("resize", scheduleRead)
    document.addEventListener("selectionchange", handleSelectionChange)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("focusin", handleFocusIn)

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      element.removeEventListener("mouseup", scheduleRead)
      element.removeEventListener("keyup", scheduleRead)
      element.removeEventListener("scroll", scheduleRead, { capture: true })
      window.removeEventListener("resize", scheduleRead)
      document.removeEventListener("selectionchange", handleSelectionChange)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("focusin", handleFocusIn)
    }
  }, [element, read])

  return selection
}

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
