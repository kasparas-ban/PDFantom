import { persist } from "zustand/middleware"
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla"

import { DEFAULT_CHAT_EFFORT, type ChatApi } from "../../../shared/chat-api"
import type { ChatThreadSelection } from "../../../shared/chat-thread-api"
import {
  CHAT_MODEL_SOURCES,
  mergeSourceListings,
  supportsEffortChatModel,
  type ChatModelOption,
  type ChatModelSourceId,
} from "./chat-models"

export const DEFAULT_CHAT_MODEL = "openrouter/free"

export type ChatModelPreference = {
  model: string
  effort: string
}

const DEFAULT_CHAT_MODEL_PREFERENCE: ChatModelPreference = {
  model: DEFAULT_CHAT_MODEL,
  effort: DEFAULT_CHAT_EFFORT,
}

export type ChatModelState = {
  model: string
  effort: string
  preference: ChatModelPreference
  favoriteModelIds: string[]
  models: readonly ChatModelOption[]
  unavailableSources: Partial<Record<ChatModelSourceId, string>>
  setModel: (model: string) => void
  setEffort: (effort: string) => void
  restoreSelection: (selection: ChatThreadSelection | null) => void
  toggleFavorite: (modelId: string) => void
  loadSourceListings: (source: ChatModelSourceId) => Promise<void>
}

type PersistedChatModelState = Pick<ChatModelState, "favoriteModelIds" | "preference">

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")

const createChatModelState =
  (platform: Pick<ChatApi, "listModels">): StateCreator<ChatModelState> =>
  (set) => ({
    model: DEFAULT_CHAT_MODEL,
    effort: DEFAULT_CHAT_EFFORT,
    preference: DEFAULT_CHAT_MODEL_PREFERENCE,
    favoriteModelIds: [],
    models: CHAT_MODEL_SOURCES.flatMap((source) => source.bundledModels),
    unavailableSources: {},
    setModel: (id) =>
      set((state) => {
        const model = state.models.find((option) => option.id === id)
        if (!model || model.unavailableReason) return state

        return preferSelection(state, { model: model.id })
      }),
    setEffort: (effort) => set((state) => preferSelection(state, { effort })),
    restoreSelection: (selection) =>
      set((state) => {
        const remembered = selection && state.models.find((m) => m.id === selection.model)
        if (!selection || !remembered || remembered.unavailableReason) {
          return resolveSelection(state.models, state.preference)
        }

        return resolveSelection(state.models, {
          model: selection.model,
          effort: selection.effort ?? DEFAULT_CHAT_EFFORT,
        })
      }),
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

        return {
          models,
          unavailableSources: {
            ...state.unavailableSources,
            [sourceId]: result.unavailableReason,
          },
          ...resolveSelection(models, state.preference),
        }
      })
    },
  })

export const createChatModelStore = (platform: Pick<ChatApi, "listModels">) =>
  createStore<ChatModelState>()(
    persist(createChatModelState(platform), {
      name: "pdfantom-chat-models",
      partialize: ({ favoriteModelIds, preference }) => ({ favoriteModelIds, preference }),
      merge: (persisted, current) => {
        const stored =
          typeof persisted === "object" && persisted !== null
            ? (persisted as Partial<PersistedChatModelState>)
            : {}
        const preference = readPreference(stored.preference) ?? current.preference

        return {
          ...current,
          favoriteModelIds: isStringArray(stored.favoriteModelIds)
            ? stored.favoriteModelIds
            : current.favoriteModelIds,
          preference,
          ...resolveSelection(current.models, preference),
        }
      },
    }),
  )

export type ChatModelStore = StoreApi<ChatModelState>

export function currentSelection({
  model,
  effort,
  models,
}: Pick<ChatModelState, "model" | "effort" | "models">): ChatThreadSelection {
  const selected = models.find((option) => option.id === model)
  if (!selected) throw new Error("The selected chat model must belong to the catalog")

  return { model, source: selected.source, ...(supportsEffortChatModel(selected) && { effort }) }
}

export function createSideChatModelStore(
  platform: Pick<ChatApi, "listModels">,
  main: ChatModelStore,
) {
  const store = createStore<ChatModelState>()((set, get, api) => ({
    ...createChatModelState(platform)(set, get, api),
    toggleFavorite: (modelId) => main.getState().toggleFavorite(modelId),
  }))
  const mirror = ({ models, favoriteModelIds, unavailableSources }: ChatModelState) =>
    store.setState((state) => ({
      models,
      favoriteModelIds,
      unavailableSources,
      ...resolveSelection(models, state.preference),
    }))

  mirror(main.getState())
  main.subscribe(mirror)

  return store
}

function readPreference(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined

  const { model, effort } = value as Partial<ChatModelPreference>
  if (typeof model !== "string" || typeof effort !== "string") return undefined

  return { model, effort } satisfies ChatModelPreference
}

function preferSelection(
  state: Pick<ChatModelState, "models" | "preference">,
  changes: Partial<ChatModelPreference>,
) {
  const preference = { ...state.preference, ...changes }

  return { preference, ...resolveSelection(state.models, preference) }
}

function resolveSelection(models: readonly ChatModelOption[], preference: ChatModelPreference) {
  const preferred = models.find((model) => model.id === preference.model)
  const selected =
    preferred && !preferred.unavailableReason
      ? preferred
      : models.find((model) => model.id === DEFAULT_CHAT_MODEL)

  return {
    model: selected?.id ?? DEFAULT_CHAT_MODEL,
    effort: resolveEffort(selected, preference.effort),
  }
}

function resolveEffort(model: Pick<ChatModelOption, "effortLevels"> | undefined, effort: string) {
  const levels = model?.effortLevels
  if (!levels?.length || levels.includes(effort)) return effort

  return levels.includes(DEFAULT_CHAT_EFFORT) ? DEFAULT_CHAT_EFFORT : levels[0]
}
