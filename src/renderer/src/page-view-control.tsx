import { BookOpen, Square } from "lucide-react"

import { Button } from "./components/ui/button"
import { useReaderSession } from "./store/reader-session-provider"

export function PageViewControl() {
  const pageView = useReaderSession((state) => state.pageView)
  const togglePageView = useReaderSession((state) => state.togglePageView)

  const { Icon, label } =
    pageView === "single"
      ? { Icon: BookOpen, label: "Switch to double-page view" }
      : { Icon: Square, label: "Switch to single-page view" }

  return (
    <Button
      aria-label={label}
      className="size-7 rounded-lg border-border/80 bg-muted/50 shadow-xs"
      onClick={togglePageView}
      size="icon-sm"
      title={label}
      type="button"
      variant="outline"
    >
      <Icon />
    </Button>
  )
}
