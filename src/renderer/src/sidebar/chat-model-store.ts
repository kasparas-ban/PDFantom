import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import type { ChatModelInfo } from "../../../shared/chat-api"
import {
  CHAT_MODEL_PROVIDERS,
  mergeProviderListings,
  type ChatModelOption,
  type ChatModelSourceId,
} from "./chat-models"

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-nano"

export type ChatModelState = {
  model: string
  favoriteModelIds: string[]
  models: readonly ChatModelOption[]
  setModel: (model: string) => void
  toggleFavorite: (modelId: string) => void
  addProviderListings: (source: ChatModelSourceId, listings: ChatModelInfo[]) => void
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")

export const createChatModelStore = () =>
  createStore<ChatModelState>()(
    persist(
      (set) => ({
        model: DEFAULT_CHAT_MODEL,
        favoriteModelIds: [],
        models: CHAT_MODEL_PROVIDERS.flatMap((provider) => provider.bundledModels),
        setModel: (id) =>
          set((state) => {
            const model = state.models.find((option) => option.id === id)
            if (!model || model.unavailableReason) return state

            return { model: model.id }
          }),
        toggleFavorite: (modelId) =>
          set((state) => ({
            favoriteModelIds: state.favoriteModelIds.includes(modelId)
              ? state.favoriteModelIds.filter((id) => id !== modelId)
              : [...state.favoriteModelIds, modelId],
          })),
        addProviderListings: (source, listings) => {
          const provider = CHAT_MODEL_PROVIDERS.find((option) => option.source === source)
          if (!provider?.liveListings) return

          set((state) => ({
            models: mergeProviderListings(state.models, listings, provider.mapListing),
          }))
        },
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
