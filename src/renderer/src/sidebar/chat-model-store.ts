import { createStore } from "zustand/vanilla"

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-nano"

export type ChatModelState = {
  model: string
  setModel: (model: string) => void
}

export const createChatModelStore = (initialModel = DEFAULT_CHAT_MODEL) =>
  createStore<ChatModelState>()((set) => ({
    model: initialModel,
    setModel: (model) => set({ model }),
  }))

export type ChatModelStore = ReturnType<typeof createChatModelStore>
