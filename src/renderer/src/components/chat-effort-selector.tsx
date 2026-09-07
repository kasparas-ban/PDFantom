import { ChevronDownIcon, GaugeIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePagePortalContainer } from "../app/page-surface"
import { useChatModel } from "../sidebar/chat-session"

const EFFORT_LABELS: Record<string, string> = {
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
  ultra: "Ultra",
}

function effortLabel(level: string) {
  return EFFORT_LABELS[level] ?? level.charAt(0).toUpperCase() + level.slice(1)
}

export function ChatEffortSelector() {
  const { selectedModel, effort, setEffort } = useChatModel()
  const portalContainer = usePagePortalContainer()
  const levels = selectedModel.effortLevels ?? []

  if (levels.length === 0) return null

  const handleEffortChange = (value: unknown) => {
    if (typeof value === "string" && levels.includes(value)) setEffort(value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Choose effort"
        className="flex h-7 min-w-0 shrink-0 items-center justify-start gap-1 rounded-full px-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,translate,scale] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] data-popup-open:bg-muted"
        title={`Reasoning effort: ${effortLabel(effort)}`}
      >
        <GaugeIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{effortLabel(effort)}</span>
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
          {levels.map((level) => (
            <DropdownMenuRadioItem closeOnClick key={level} value={level}>
              <span className="truncate">{effortLabel(level)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
