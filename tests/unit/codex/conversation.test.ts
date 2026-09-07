import { expect, test } from "vitest"

import {
  codexTurnErrorMessage,
  flattenTranscript,
  planCodexTurn,
} from "../../../src/main/codex/conversation"
import type { ChatMessage } from "../../../src/shared/chat-api"

const user = (id: string, content: string): ChatMessage => ({ id, role: "user", content })
const assistant = (id: string, content: string): ChatMessage => ({ id, role: "assistant", content })

const firstTurn = [user("u1", "What is osmosis?")]
const secondTurn = [
  ...firstTurn,
  assistant("a1", "Water moving across a membrane."),
  user("u2", "Why?"),
]
const afterFirstTurn = { threadId: "thread-1", lastUserMessageId: "u1", messageCount: 1 }

test("a Conversation without a Codex Thread starts one from the newest message alone", () => {
  expect(planCodexTurn(undefined, firstTurn)).toEqual({
    kind: "rebuild",
    input: "What is osmosis?",
  })
})

test("the next message continues the Thread that saw the previous exchange", () => {
  expect(planCodexTurn(afterFirstTurn, secondTurn)).toEqual({
    kind: "continue",
    threadId: "thread-1",
    input: "Why?",
  })
})

test("regenerating, editing or restarting diverges from the Thread and rebuilds it", () => {
  const regenerate = planCodexTurn(afterFirstTurn, firstTurn)
  const edited = planCodexTurn(afterFirstTurn, [
    user("u1-edited", "What is diffusion?"),
    assistant("a1", "Particles spreading out."),
    user("u2", "Why?"),
  ])
  const restarted = planCodexTurn(undefined, secondTurn)

  expect(regenerate).toEqual({ kind: "rebuild", input: "What is osmosis?" })
  expect(edited.kind).toBe("rebuild")
  expect(restarted).toEqual({ kind: "rebuild", input: flattenTranscript(secondTurn) })
})

test("a Thread that failed to reply is not continued past the gap", () => {
  expect(planCodexTurn(afterFirstTurn, [...firstTurn, user("u2", "Are you there?")]).kind).toBe(
    "rebuild",
  )
})

test("only a User message can start a turn", () => {
  expect(() => planCodexTurn(undefined, [assistant("a1", "Hello")])).toThrow()
  expect(() => planCodexTurn(undefined, [])).toThrow()
})

test("flattening keeps every role boundary as labelled text", () => {
  expect(flattenTranscript(secondTurn)).toBe(
    [
      "The conversation so far, oldest first:",
      "",
      "User:\nWhat is osmosis?",
      "",
      "Assistant:\nWater moving across a membrane.",
      "",
      "The User's new message:\nWhy?",
    ].join("\n"),
  )
})

test("surfaces the upstream message Codex wraps inside a turn error", () => {
  expect(
    codexTurnErrorMessage({
      message: JSON.stringify({
        type: "error",
        status: 400,
        error: { type: "invalid_request_error", message: "The model is not supported." },
      }),
      codexErrorInfo: "other",
    }),
  ).toBe("The model is not supported.")
  expect(codexTurnErrorMessage({ message: "You have hit your usage limit." })).toBe(
    "You have hit your usage limit.",
  )
  expect(codexTurnErrorMessage({ message: "  " })).toBe(
    "Unable to generate response. Please try again later.",
  )
  expect(codexTurnErrorMessage(null)).toBe("Unable to generate response. Please try again later.")
})
