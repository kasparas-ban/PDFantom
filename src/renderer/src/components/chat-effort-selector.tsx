import { ChevronDownIcon, GaugeIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CHAT_EFFORT_LEVELS, type ChatEffortLevel } from "../../../shared/chat-api"
import { usePagePortalContainer } from "../app/page-surface"
import { supportsEffortChatModel } from "../sidebar/chat-models"
import { useChatModel } from "../sidebar/chat-session"

const EFFORT_LABELS: Record<ChatEffortLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

const isEffortLevel = (value: unknown): value is ChatEffortLevel =>
  CHAT_EFFORT_LEVELS.some((level) => level === value)

export function ChatEffortSelector() {
  const { selectedModel, effort, setEffort } = useChatModel()
  const portalContainer = usePagePortalContainer()

  if (!supportsEffortChatModel(selectedModel)) return null

  const handleEffortChange = (value: unknown) => {
    if (isEffortLevel(value)) setEffort(value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Choose effort"
        className="flex h-7 min-w-0 shrink-0 items-center justify-start gap-1 rounded-full px-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,translate,scale] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] data-popup-open:bg-muted"
        title={`Reasoning effort: ${EFFORT_LABELS[effort]}`}
      >
        <GaugeIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{EFFORT_LABELS[effort]}</span>
        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        portalContainer={portalContainer}
        side="top"
        sideOffset={6}
      >
        <div aria-hidden="true" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Reasoning effort
        </div>
        <DropdownMenuRadioGroup
          aria-label="Reasoning effort"
          value={effort}
          onValueChange={handleEffortChange}
        >
          {CHAT_EFFORT_LEVELS.map((level) => (
            <DropdownMenuRadioItem closeOnClick key={level} value={level}>
              <span className="truncate">{EFFORT_LABELS[level]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
