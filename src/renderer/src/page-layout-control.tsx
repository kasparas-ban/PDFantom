import { Button } from "./components/ui/button"
import { LayoutHorizontalIcon, LayoutVerticalIcon } from "./icons/layout-icons"
import { useReaderSession } from "./store/reader-session-provider"

export function PageLayoutControl() {
  const pageLayout = useReaderSession((state) => state.pageLayout)
  const togglePageLayout = useReaderSession((state) => state.togglePageLayout)

  const { Icon, label } =
    pageLayout === "vertical"
      ? { Icon: LayoutHorizontalIcon, label: "Switch to horizontal page layout" }
      : { Icon: LayoutVerticalIcon, label: "Switch to vertical page layout" }

  return (
    <Button
      aria-label={label}
      className="size-7 rounded-lg border-border/80 bg-muted/50 shadow-xs"
      onClick={togglePageLayout}
      size="icon-sm"
      title={label}
      type="button"
      variant="outline"
    >
      <Icon />
    </Button>
  )
}
