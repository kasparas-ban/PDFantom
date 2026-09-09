import { expect, test } from "vitest"

import {
  codexTurnErrorMessage,
  flattenTranscript,
  planCodexTurn,
} from "../../../src/main/codex/conversation"
import { SIDE_CHAT_INSTRUCTION } from "../../../src/main/side-chat-context"
import type { ChatMessage } from "../../../src/shared/chat-api"
import type { ChatThreadMessage } from "../../../src/shared/chat-thread-api"

const user = (id: string, content: string): ChatMessage => ({ id, role: "user", content })
const assistant = (id: string, content: string): ChatMessage => ({ id, role: "assistant", content })
const parentMessage = (role: ChatThreadMessage["role"], content: string): ChatThreadMessage => ({
  id: `${role}-${content}`,
  role,
  content,
  status: { type: "complete" },
  createdAt: "2026-09-07T10:00:00.000Z",
})
const parent = [
  parentMessage("user", "Summarise chapter one."),
  parentMessage("assistant", "Chapter one introduces osmosis."),
]

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

test("a Side Chat's first turn carries the parent transcript before its own history", () => {
  expect(planCodexTurn(undefined, firstTurn, parent)).toEqual({
    kind: "rebuild",
    input: [
      SIDE_CHAT_INSTRUCTION,
      "",
      "User:\nSummarise chapter one.",
      "",
      "Assistant:\nChapter one introduces osmosis.",
      "",
      "What is osmosis?",
    ].join("\n"),
  })
})

test("a continued Side Chat turn only carries what the parent gained since the last turn", () => {
  const state = { ...afterFirstTurn, parentMessageCount: 2 }
  const grown = [...parent, parentMessage("user", "And chapter two?")]

  expect(planCodexTurn(state, secondTurn, parent)).toMatchObject({
    kind: "continue",
    input: "Why?",
  })
  expect(planCodexTurn(state, secondTurn, grown)).toEqual({
    kind: "continue",
    threadId: "thread-1",
    input: [
      "The main conversation has continued:",
      "",
      "User:\nAnd chapter two?",
      "",
      "The User's new message:\nWhy?",
    ].join("\n"),
  })
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
