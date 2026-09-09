import type { Attachment, CompleteAttachment, CreateAttachment } from "@assistant-ui/react"

import {
  isSameQuoteSource,
  parseQuoteSource,
  type ChatThreadQuote,
} from "../../../shared/chat-thread-api"

const QUOTE_TYPE = "quote"
const QUOTE_SOURCE_PART = "pdfantom.quote-source"

type QuoteAttachmentLike = {
  readonly type?: string
  readonly content?: Attachment["content"]
}

export function createQuoteAttachment(quote: ChatThreadQuote): CreateAttachment {
  return {
    type: QUOTE_TYPE,
    name: "Quote",
    contentType: "text/x-pdfantom-quote",
    content: [
      { type: "text", text: quote.text },
      { type: "data", name: QUOTE_SOURCE_PART, data: quote.source },
    ],
  }
}

export function toCompleteQuoteAttachment(quote: ChatThreadQuote, id: string): CompleteAttachment {
  return { ...createQuoteAttachment(quote), id, type: QUOTE_TYPE, status: { type: "complete" } }
}

export function readQuoteAttachment(attachment: QuoteAttachmentLike): ChatThreadQuote | null {
  if (attachment.type !== QUOTE_TYPE) return null

  const content = attachment.content ?? []
  const text = content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
  const sourcePart = content.find((part) => part.type === "data" && part.name === QUOTE_SOURCE_PART)
  const source = sourcePart?.type === "data" ? parseQuoteSource(sourcePart.data) : null
  if (!text || !source) return null

  return { text, source }
}

export function readQuoteAttachments(attachments: readonly QuoteAttachmentLike[]) {
  return attachments.map(readQuoteAttachment).filter((quote) => quote !== null)
}

export function hasQuote(attachments: readonly QuoteAttachmentLike[], quote: ChatThreadQuote) {
  return readQuoteAttachments(attachments).some(
    (existing) => existing.text === quote.text && isSameQuoteSource(existing.source, quote.source),
  )
}
