import type { Attachment, CompleteAttachment, CreateAttachment } from "@assistant-ui/react"

const QUOTE_TYPE = "quote"
const QUOTE_SOURCE_PART = "pdfantom.quote-source"

export type ChatQuote = {
  readonly text: string
  readonly messageId: string
}

type QuoteAttachmentLike = {
  readonly type?: string
  readonly content?: Attachment["content"]
}

export function createQuoteAttachment(quote: ChatQuote): CreateAttachment {
  return {
    type: QUOTE_TYPE,
    name: "Quote",
    contentType: "text/x-pdfantom-quote",
    content: [
      { type: "text", text: quote.text },
      { type: "data", name: QUOTE_SOURCE_PART, data: { messageId: quote.messageId } },
    ],
  }
}

export function toCompleteQuoteAttachment(quote: ChatQuote, id: string): CompleteAttachment {
  return { ...createQuoteAttachment(quote), id, type: QUOTE_TYPE, status: { type: "complete" } }
}

export function readQuoteAttachment(attachment: QuoteAttachmentLike): ChatQuote | null {
  if (attachment.type !== QUOTE_TYPE) return null

  const content = attachment.content ?? []
  const text = content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
  if (!text) return null

  const source = content.find((part) => part.type === "data" && part.name === QUOTE_SOURCE_PART)
  const messageId: unknown = source?.type === "data" ? source.data?.messageId : undefined

  return { text, messageId: typeof messageId === "string" ? messageId : "" }
}

export function readQuoteAttachments(attachments: readonly QuoteAttachmentLike[]) {
  return attachments.map(readQuoteAttachment).filter((quote) => quote !== null)
}

export function hasQuote(attachments: readonly QuoteAttachmentLike[], quote: ChatQuote) {
  return readQuoteAttachments(attachments).some(
    (existing) => existing.text === quote.text && existing.messageId === quote.messageId,
  )
}
