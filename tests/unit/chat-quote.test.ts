import { describe, expect, test } from "vitest"

import {
  createQuoteAttachment,
  hasQuote,
  readQuoteAttachment,
  readQuoteAttachments,
} from "../../src/renderer/src/sidebar/chat-quote"
import {
  describeQuotePages,
  formatUserMessageContent,
  parseQuoteSource,
  type ChatThreadQuote,
} from "../../src/shared/chat-thread-api"

const fromMessage = (text: string, messageId: string): ChatThreadQuote => ({
  text,
  source: { type: "message", messageId },
})

const fromDocument = (text: string, firstPage: number, lastPage = firstPage): ChatThreadQuote => ({
  text,
  source: { type: "document", firstPage, lastPage },
})

describe("quote attachments", () => {
  test("round-trip text and source through attachment content", () => {
    const attachment = createQuoteAttachment(fromMessage("keepalives at 20", "a1"))

    expect(attachment).toMatchObject({ type: "quote", contentType: "text/x-pdfantom-quote" })
    expect(readQuoteAttachment(attachment)).toEqual(fromMessage("keepalives at 20", "a1"))
    expect(readQuoteAttachment(createQuoteAttachment(fromDocument("soil", 2, 3)))).toEqual(
      fromDocument("soil", 2, 3),
    )
  })

  test("ignore attachments of other types, quotes without text, and quotes without a source", () => {
    expect(
      readQuoteAttachment({ type: "document", content: [{ type: "text", text: "a report" }] }),
    ).toBeNull()
    expect(readQuoteAttachment({ type: "quote", content: [] })).toBeNull()
    expect(
      readQuoteAttachment({ type: "quote", content: [{ type: "text", text: "orphan" }] }),
    ).toBeNull()
  })

  test("list quotes in attachment order", () => {
    const quotes = readQuoteAttachments([
      createQuoteAttachment(fromMessage("first", "a1")),
      { type: "file", content: [] },
      createQuoteAttachment(fromDocument("second", 4)),
    ])

    expect(quotes).toEqual([fromMessage("first", "a1"), fromDocument("second", 4)])
  })

  test("detect a duplicate only when text and source match", () => {
    const attachments = [
      createQuoteAttachment(fromMessage("same", "a1")),
      createQuoteAttachment(fromDocument("same", 1, 2)),
    ]

    expect(hasQuote(attachments, fromMessage("same", "a1"))).toBe(true)
    expect(hasQuote(attachments, fromMessage("same", "a2"))).toBe(false)
    expect(hasQuote(attachments, fromMessage("other", "a1"))).toBe(false)
    expect(hasQuote(attachments, fromDocument("same", 1, 2))).toBe(true)
    expect(hasQuote(attachments, fromDocument("same", 1))).toBe(false)
  })
})

describe("quote sources", () => {
  test("accept message and document sources and reject anything else", () => {
    expect(parseQuoteSource({ type: "message", messageId: "a1" })).toEqual({
      type: "message",
      messageId: "a1",
    })
    expect(parseQuoteSource({ type: "document", firstPage: 2, lastPage: 3 })).toEqual({
      type: "document",
      firstPage: 2,
      lastPage: 3,
    })
    expect(parseQuoteSource({ type: "message" })).toBeNull()
    expect(parseQuoteSource({ type: "document", firstPage: 3, lastPage: 2 })).toBeNull()
    expect(parseQuoteSource({ type: "document", firstPage: 0, lastPage: 1 })).toBeNull()
    expect(parseQuoteSource({ type: "document", firstPage: 1.5, lastPage: 2 })).toBeNull()
    expect(parseQuoteSource({ messageId: "a1" })).toBeNull()
    expect(parseQuoteSource(null)).toBeNull()
  })

  test("describe document pages and nothing for messages", () => {
    expect(describeQuotePages({ type: "document", firstPage: 12, lastPage: 12 })).toBe("p. 12")
    expect(describeQuotePages({ type: "document", firstPage: 12, lastPage: 13 })).toBe("pp. 12–13")
    expect(describeQuotePages({ type: "message", messageId: "a1" })).toBeNull()
  })
})

describe("model template", () => {
  test("prepend one labelled blockquote per quote before the typed text", () => {
    const content = formatUserMessageContent("Why 20?", [
      fromMessage("first quote", "a1"),
      fromMessage("second quote\ncontinues here", "a1"),
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

  test("label document quotes with their page or page range", () => {
    expect(
      formatUserMessageContent("Explain.", [
        fromDocument("An ecosystem is a community", 2),
        fromDocument("Energy enters most ecosystems as sunlight.", 2, 3),
      ]),
    ).toBe(
      [
        "Quoting from the document, page 2:",
        "> An ecosystem is a community",
        "",
        "Quoting from the document, pages 2–3:",
        "> Energy enters most ecosystems as sunlight.",
        "",
        "Explain.",
      ].join("\n"),
    )
  })

  test("omit the trailing question when nothing was typed", () => {
    expect(formatUserMessageContent("  ", [fromMessage("alone", "a1")])).toBe(
      "Quoting from the conversation:\n> alone",
    )
  })

  test("keep blank lines inside a quote as empty blockquote lines", () => {
    expect(formatUserMessageContent("", [fromMessage("a\n\nb", "a1")])).toBe(
      "Quoting from the conversation:\n> a\n>\n> b",
    )
  })

  test("leave a message without quotes untouched", () => {
    expect(formatUserMessageContent("Hello", [])).toBe("Hello")
  })
})
