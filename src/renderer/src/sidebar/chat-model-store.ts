import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import { CHAT_MODELS } from "./chat-models"

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-nano"

export type ChatModelState = {
  model: string
  favoriteModelIds: string[]
  setModel: (model: string) => void
  toggleFavorite: (modelId: string) => void
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")

export const createChatModelStore = (initialModel = DEFAULT_CHAT_MODEL) =>
  createStore<ChatModelState>()(
    persist(
      (set) => ({
        model: initialModel,
        favoriteModelIds: [],
        setModel: (model) => set({ model }),
        toggleFavorite: (modelId) =>
          set((state) => ({
            favoriteModelIds: state.favoriteModelIds.includes(modelId)
              ? state.favoriteModelIds.filter((id) => id !== modelId)
              : [...state.favoriteModelIds, modelId],
          })),
      }),
      {
        name: "pdfantom-chat-models",
        partialize: ({ favoriteModelIds }) => ({ favoriteModelIds }),
        merge: (persisted, current) => {
          const persistedFavorites =
            typeof persisted === "object" && persisted !== null
              ? (persisted as Partial<Pick<ChatModelState, "favoriteModelIds">>).favoriteModelIds
              : undefined

          return {
            ...current,
            favoriteModelIds: isStringArray(persistedFavorites)
              ? persistedFavorites.filter((id) => CHAT_MODELS.some((model) => model.id === id))
              : current.favoriteModelIds,
          }
        },
      },
    ),
  )

export type ChatModelStore = ReturnType<typeof createChatModelStore>
