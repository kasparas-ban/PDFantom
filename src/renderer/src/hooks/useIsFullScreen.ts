import { useEffect, useState } from "react"

export function useIsFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false)

  useEffect(() => {
    let active = true
    let receivedChange = false

    const unsubscribe = window.pdfantom.onFullScreenChange((value) => {
      receivedChange = true
      setIsFullScreen(value)
    })

    void window.pdfantom.getIsFullScreen().then((value) => {
      if (active && !receivedChange) setIsFullScreen(value)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return isFullScreen
}
