import { expect, test } from "vitest"

import {
  formatParentMessages,
  parentContextBlock,
  SIDE_CHAT_INSTRUCTION,
} from "../../src/main/side-chat-context"
import type { ChatThreadMessage } from "../../src/shared/chat-thread-api"

const message = (
  id: string,
  role: ChatThreadMessage["role"],
  content: string,
  quotes?: ChatThreadMessage["quotes"],
): ChatThreadMessage => ({
  id,
  role,
  content,
  status: { type: "complete" },
  createdAt: "2026-09-07T10:00:00.000Z",
  ...(quotes && { quotes }),
})

test("the parent transcript labels roles and formats User Quotes like the live request", () => {
  const messages = [
    message("u1", "user", "What did the tests confirm?"),
    message("a1", "assistant", "Keepalives at 20, 40, and 60 seconds."),
    message("u2", "user", "Why 20?", [
      { text: "Keepalives at 20", source: { type: "message", messageId: "a1" } },
    ]),
  ]

  expect(formatParentMessages(messages)).toBe(
    [
      "User:\nWhat did the tests confirm?",
      "Assistant:\nKeepalives at 20, 40, and 60 seconds.",
      "User:\nQuoting from the conversation:\n> Keepalives at 20\n\nWhy 20?",
    ].join("\n\n"),
  )
})

test("the context block opens with the side conversation instruction", () => {
  expect(parentContextBlock([message("u1", "user", "Hello")])).toBe(
    `${SIDE_CHAT_INSTRUCTION}\n\nUser:\nHello`,
  )
})
