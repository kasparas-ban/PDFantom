import { describe, expect, test } from "vitest"

import {
  createQuoteAttachment,
  hasQuote,
  readQuoteAttachment,
  readQuoteAttachments,
} from "../../src/renderer/src/sidebar/chat-quote"
import { formatUserMessageContent } from "../../src/shared/chat-thread-api"

describe("quote attachments", () => {
  test("round-trip text and source message id through attachment content", () => {
    const attachment = createQuoteAttachment({ text: "keepalives at 20", messageId: "a1" })

    expect(attachment).toMatchObject({ type: "quote", contentType: "text/x-pdfantom-quote" })
    expect(readQuoteAttachment(attachment)).toEqual({ text: "keepalives at 20", messageId: "a1" })
  })

  test("ignore attachments of other types and quotes without text", () => {
    expect(
      readQuoteAttachment({ type: "document", content: [{ type: "text", text: "a report" }] }),
    ).toBeNull()
    expect(readQuoteAttachment({ type: "quote", content: [] })).toBeNull()
  })

  test("tolerate a quote whose source part is missing", () => {
    expect(
      readQuoteAttachment({ type: "quote", content: [{ type: "text", text: "orphan" }] }),
    ).toEqual({ text: "orphan", messageId: "" })
  })

  test("list quotes in attachment order", () => {
    const quotes = readQuoteAttachments([
      createQuoteAttachment({ text: "first", messageId: "a1" }),
      { type: "file", content: [] },
      createQuoteAttachment({ text: "second", messageId: "u1" }),
    ])

    expect(quotes).toEqual([
      { text: "first", messageId: "a1" },
      { text: "second", messageId: "u1" },
    ])
  })

  test("detect a duplicate only when text and source match", () => {
    const attachments = [createQuoteAttachment({ text: "same", messageId: "a1" })]

    expect(hasQuote(attachments, { text: "same", messageId: "a1" })).toBe(true)
    expect(hasQuote(attachments, { text: "same", messageId: "a2" })).toBe(false)
    expect(hasQuote(attachments, { text: "other", messageId: "a1" })).toBe(false)
  })
})

describe("model template", () => {
  test("prepend one labelled blockquote per quote before the typed text", () => {
    const content = formatUserMessageContent("Why 20?", [
      { text: "first quote", messageId: "a1" },
      { text: "second quote\ncontinues here", messageId: "a1" },
    ])

    expect(content).toBe(
      [
        "Quoting from the conversation:",
        "> first quote",
        "",
        "Quoting from the conversation:",
        "> second quote",
        "> continues here",
        "",
        "Why 20?",
      ].join("\n"),
    )
  })

  test("omit the trailing question when nothing was typed", () => {
    expect(formatUserMessageContent("  ", [{ text: "alone", messageId: "a1" }])).toBe(
      "Quoting from the conversation:\n> alone",
    )
  })

  test("keep blank lines inside a quote as empty blockquote lines", () => {
    expect(formatUserMessageContent("", [{ text: "a\n\nb", messageId: "a1" }])).toBe(
      "Quoting from the conversation:\n> a\n>\n> b",
    )
  })

  test("leave a message without quotes untouched", () => {
    expect(formatUserMessageContent("Hello", [])).toBe("Hello")
  })
})
