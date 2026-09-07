import { persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"

import { DEFAULT_CHAT_EFFORT, type ChatApi } from "../../../shared/chat-api"
import {
  CHAT_MODEL_SOURCES,
  mergeSourceListings,
  type ChatModelOption,
  type ChatModelSourceId,
} from "./chat-models"

export const DEFAULT_CHAT_MODEL = "openrouter/free"

export type ChatModelState = {
  model: string
  effort: string
  favoriteModelIds: string[]
  models: readonly ChatModelOption[]
  unavailableSources: Partial<Record<ChatModelSourceId, string>>
  setModel: (model: string) => void
  setEffort: (effort: string) => void
  toggleFavorite: (modelId: string) => void
  loadSourceListings: (source: ChatModelSourceId) => Promise<void>
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")

export const createChatModelStore = (platform: Pick<ChatApi, "listModels">) =>
  createStore<ChatModelState>()(
    persist(
      (set) => ({
        model: DEFAULT_CHAT_MODEL,
        effort: DEFAULT_CHAT_EFFORT,
        favoriteModelIds: [],
        models: CHAT_MODEL_SOURCES.flatMap((source) => source.bundledModels),
        unavailableSources: {},
        setModel: (id) =>
          set((state) => {
            const model = state.models.find((option) => option.id === id)
            if (!model || model.unavailableReason) return state

            return { model: model.id, effort: resolveEffort(model, state.effort) }
          }),
        setEffort: (effort) => set({ effort }),
        toggleFavorite: (modelId) =>
          set((state) => ({
            favoriteModelIds: state.favoriteModelIds.includes(modelId)
              ? state.favoriteModelIds.filter((id) => id !== modelId)
              : [...state.favoriteModelIds, modelId],
          })),
        loadSourceListings: async (sourceId) => {
          const source = CHAT_MODEL_SOURCES.find((option) => option.source === sourceId)
          if (!source) return

          const result = await platform.listModels(sourceId).catch(() => undefined)
          if (!result?.models) return

          const listings = result.models.filter((listing) => !source.excludeListing?.(listing))
          const bundledIds = new Set(source.bundledModels.map((model) => model.id))

          set((state) => {
            const retained = state.models.filter(
              (model) => model.source !== sourceId || bundledIds.has(model.id),
            )
            const models = mergeSourceListings(retained, listings, source.mapListing).map((model) =>
              model.source === sourceId
                ? Object.assign({}, model, { unavailableReason: result.unavailableReason })
                : model,
            )
            const selected = models.find((model) => model.id === state.model)
            const nextModel =
              selected && !selected.unavailableReason
                ? selected
                : models.find((model) => model.id === DEFAULT_CHAT_MODEL)

            return {
              models,
              unavailableSources: {
                ...state.unavailableSources,
                [sourceId]: result.unavailableReason,
              },
              model: nextModel?.id ?? DEFAULT_CHAT_MODEL,
              effort: resolveEffort(nextModel, state.effort),
            }
          })
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

function resolveEffort(model: Pick<ChatModelOption, "effortLevels"> | undefined, effort: string) {
  const levels = model?.effortLevels
  if (!levels?.length || levels.includes(effort)) return effort

  return levels.includes(DEFAULT_CHAT_EFFORT) ? DEFAULT_CHAT_EFFORT : levels[0]
}
