import { useEffect, useState } from "react"

import { usePlatform } from "../app/platform"

export function useIsFullScreen() {
  const platform = usePlatform()
  const [isFullScreen, setIsFullScreen] = useState(false)

  useEffect(() => {
    let active = true
    let receivedChange = false

    const unsubscribe = platform.onFullScreenChange((value) => {
      receivedChange = true
      setIsFullScreen(value)
    })

    void platform.getIsFullScreen().then((value) => {
      if (active && !receivedChange) setIsFullScreen(value)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [platform])

  return isFullScreen
}
