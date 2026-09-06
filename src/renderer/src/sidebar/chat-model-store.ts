import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import { CHAT_MODEL_PROVIDERS, type ChatModelOption, type ChatModelSourceId } from "./chat-models"

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-nano"

export type ChatModelState = {
  model: string
  favoriteModelIds: string[]
  providerModels: Record<ChatModelSourceId, readonly ChatModelOption[]>
  setModel: (model: string) => void
  toggleFavorite: (modelId: string) => void
  setProviderModels: (source: ChatModelSourceId, models: readonly ChatModelOption[]) => void
}

const initialProviderModels = Object.fromEntries(
  CHAT_MODEL_PROVIDERS.map((provider) => [provider.source, provider.bundledModels]),
) as Record<ChatModelSourceId, readonly ChatModelOption[]>

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")

export const createChatModelStore = (initialModel = DEFAULT_CHAT_MODEL) =>
  createStore<ChatModelState>()(
    persist(
      (set) => ({
        model: initialModel,
        favoriteModelIds: [],
        providerModels: initialProviderModels,
        setModel: (model) => set({ model }),
        toggleFavorite: (modelId) =>
          set((state) => ({
            favoriteModelIds: state.favoriteModelIds.includes(modelId)
              ? state.favoriteModelIds.filter((id) => id !== modelId)
              : [...state.favoriteModelIds, modelId],
          })),
        setProviderModels: (source, models) =>
          set((state) => ({ providerModels: { ...state.providerModels, [source]: models } })),
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
              ? persistedFavorites
              : current.favoriteModelIds,
          }
        },
      },
    ),
  )

export type ChatModelStore = ReturnType<typeof createChatModelStore>
