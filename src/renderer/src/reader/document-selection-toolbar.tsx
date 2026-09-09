import { SelectionToolbar } from "@/components/selection-toolbar"
import { Button } from "@/components/ui/button"
import { useTextSelection } from "@/components/use-text-selection"
import { useChatThreadStore } from "../sidebar/chat-session"
import { useAppConfig } from "../store/app-config-provider"
import { readDocumentTextSelection } from "./document-text-selection"

type DocumentSelectionToolbarProps = {
  readonly hostElement: HTMLElement | null
}

export function DocumentSelectionToolbar({ hostElement }: DocumentSelectionToolbarProps) {
  const threadStore = useChatThreadStore()
  const openChatPanel = useAppConfig((state) => state.openChatPanel)
  const selection = useTextSelection(hostElement, readDocumentTextSelection)
  if (!selection) return null

  const addToChat = () => {
    threadStore.getState().askInChat(
      {
        text: selection.text,
        source: { type: "document", firstPage: selection.firstPage, lastPage: selection.lastPage },
      },
      "main",
    )
    openChatPanel()
    window.getSelection()?.removeAllRanges()
  }

  return (
    <SelectionToolbar
      boundsRect={selection.boundsRect}
      selectionRect={selection.rect}
      slot="document-selection-toolbar"
    >
      <Button onClick={addToChat} size="sm" type="button" variant="ghost">
        Add to chat
      </Button>
    </SelectionToolbar>
  )
}
