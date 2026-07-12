import { Maximize, MoveHorizontal } from "lucide-react"

import { Button } from "./components/ui/button"
import { useReaderSession } from "./store/reader-session-provider"

export function PageFitControl() {
  const scalePreset = useReaderSession((state) => state.scalePreset)
  const setScalePreset = useReaderSession((state) => state.setScalePreset)

  const nextPreset = scalePreset === "page-fit" ? "page-width" : "page-fit"
  const { Icon, label } =
    nextPreset === "page-fit"
      ? { Icon: Maximize, label: "Fit to page" }
      : { Icon: MoveHorizontal, label: "Fit to width" }

  return (
    <Button
      aria-label={label}
      className="size-7 rounded-lg border-border/80 bg-muted/50 shadow-xs"
      onClick={() => setScalePreset(nextPreset)}
      size="icon-sm"
      title={label}
      type="button"
      variant="outline"
    >
      <Icon />
    </Button>
  )
}
