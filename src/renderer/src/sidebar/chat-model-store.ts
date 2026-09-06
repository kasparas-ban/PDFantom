import { createStore } from "zustand/vanilla"

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-nano"

export type ChatModelState = {
  model: string
  favoriteModelIds: string[]
  setModel: (model: string) => void
  toggleFavorite: (modelId: string) => void
}

export const createChatModelStore = (initialModel = DEFAULT_CHAT_MODEL) =>
  createStore<ChatModelState>()((set) => ({
    model: initialModel,
    favoriteModelIds: [],
    setModel: (model) => set({ model }),
    toggleFavorite: (modelId) =>
      set((state) => ({
        favoriteModelIds: state.favoriteModelIds.includes(modelId)
          ? state.favoriteModelIds.filter((id) => id !== modelId)
          : [...state.favoriteModelIds, modelId],
      })),
  }))

export type ChatModelStore = ReturnType<typeof createChatModelStore>
