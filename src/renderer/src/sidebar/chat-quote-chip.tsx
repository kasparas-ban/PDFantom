import { useMemo } from "react"
import { AttachmentPrimitive, useAuiState } from "@assistant-ui/react"
import { FileTextIcon, TextQuoteIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { describeQuotePages } from "../../../shared/chat-thread-api"
import { readQuoteAttachment } from "./chat-quote"

type ChatQuoteChipProps = {
  readonly removable?: boolean
  readonly className?: string
}

export function ChatQuoteChip({ removable = false, className }: ChatQuoteChipProps) {
  const attachment = useAuiState((state) => state.attachment)
  const quote = useMemo(() => readQuoteAttachment(attachment), [attachment])
  if (!quote) return null

  const pages = describeQuotePages(quote.source)
  const Icon = quote.source.type === "document" ? FileTextIcon : TextQuoteIcon

  return (
    <AttachmentPrimitive.Root
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg bg-muted/60 py-1.5 pr-1 pl-2.5 text-sm/5 text-muted-foreground",
        className,
      )}
      data-chat-quote-selectable="false"
      data-slot="chat-quote"
    >
      <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <Tooltip delay={600}>
        <TooltipTrigger
          render={
            <span className="line-clamp-2 min-w-0 flex-1 wrap-break-word whitespace-pre-wrap" />
          }
        >
          <span data-slot="chat-quote-text">{quote.text}</span>
        </TooltipTrigger>
        <TooltipContent className="max-h-60 max-w-80 overflow-hidden whitespace-pre-wrap">
          {quote.text}
        </TooltipContent>
      </Tooltip>
      {pages && (
        <span className="shrink-0 text-xs/5 tabular-nums" data-slot="chat-quote-pages">
          {pages}
        </span>
      )}
      {removable && (
        <AttachmentPrimitive.Remove asChild>
          <Button
            aria-label="Remove quote"
            className="-my-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <XIcon />
          </Button>
        </AttachmentPrimitive.Remove>
      )}
    </AttachmentPrimitive.Root>
  )
}
