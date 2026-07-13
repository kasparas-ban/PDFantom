import { Button } from "./components/ui/button"
import { FitPageIcon } from "./icons/fit-page-icon"
import { useReaderSession } from "./store/reader-session-provider"

export function PageFitControl() {
  const scalePreset = useReaderSession((state) => state.scalePreset)
  const setScalePreset = useReaderSession((state) => state.setScalePreset)

  const nextPreset =
    scalePreset === "page-fit" || scalePreset === "page-height" ? "page-width" : "page-fit"
  const label = nextPreset === "page-fit" ? "Fit to page" : "Fit to width"

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
      <FitPageIcon className={nextPreset === "page-width" ? "rotate-90" : undefined} />
    </Button>
  )
}
