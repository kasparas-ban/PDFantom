import type { ComponentType } from "react"
import { CpuIcon } from "lucide-react"

import { GoogleLogo, MetaLogo, OpenAILogo, OpenCodeLogo, XAILogo } from "@/components/model-logos"
import type { ChatModelInfo, ChatModelSourceId } from "../../../shared/chat-api"

export type { ChatModelSourceId }

export type ChatModelIcon = ComponentType<{ className?: string }>

export type ChatModelOption = {
  id: string
  name: string
  providerLabel: string
  source: ChatModelSourceId
  icon: ChatModelIcon
  /** Renders the model inside a named reveal section instead of the main list. */
  groupId?: ChatModelGroupId
}

export const CHAT_MODEL_GROUPS = {
  legacy: { label: "Legacy models" },
} as const

export type ChatModelGroupId = keyof typeof CHAT_MODEL_GROUPS

export type ChatModelProvider = {
  source: ChatModelSourceId
  label: string
  icon: ChatModelIcon
  bundledModels: readonly ChatModelOption[]
} & (
  | { liveListings: true; mapListing: (listing: ChatModelInfo) => ChatModelOption }
  | { liveListings?: undefined }
)

const BUNDLED_OPENCODE_MODELS: ChatModelOption[] = [
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: OpenAILogo,
  },
  {
    id: "openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: OpenAILogo,
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: GoogleLogo,
  },
  {
    id: "x-ai/grok-4.6",
    name: "Grok 4.6",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: XAILogo,
  },
  {
    id: "meta-llama/llama-4-scout",
    name: "Llama 4 Scout 17B",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: MetaLogo,
  },
  {
    id: "qwen/qwen3-32b",
    name: "Qwen3 32B",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: CpuIcon,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra (free)",
    providerLabel: "OpenCode · OpenRouter",
    source: "opencode",
    icon: CpuIcon,
  },
]

const BUNDLED_CHATGPT_MODELS: ChatModelOption[] = [
  {
    id: "chatgpt/gpt-6-astra",
    name: "GPT-6-Astra",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
  },
  {
    id: "chatgpt/gpt-5.6-sol",
    name: "GPT-5.6-Sol",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
  },
  {
    id: "chatgpt/gpt-5.6-terra",
    name: "GPT-5.6-Terra",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
  },
  {
    id: "chatgpt/gpt-5.6-luna",
    name: "GPT-5.6-Luna",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
  },
  {
    id: "chatgpt/gpt-5.5",
    name: "GPT-5.5",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
    groupId: "legacy",
  },
  {
    id: "chatgpt/gpt-5.4-mini",
    name: "GPT-5.4-Mini",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
    groupId: "legacy",
  },
  {
    id: "chatgpt/gpt-5.4",
    name: "GPT-5.4",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
    groupId: "legacy",
  },
]

const OPENROUTER_ICONS: { prefix: string; icon: ChatModelIcon }[] = [
  { prefix: "openai/", icon: OpenAILogo },
  { prefix: "google/", icon: GoogleLogo },
  { prefix: "x-ai/", icon: XAILogo },
  { prefix: "meta-llama/", icon: MetaLogo },
]

export const CHAT_MODEL_PROVIDERS: ChatModelProvider[] = [
  {
    source: "opencode",
    label: "OpenCode models",
    icon: OpenCodeLogo,
    bundledModels: BUNDLED_OPENCODE_MODELS,
    liveListings: true,
    mapListing: (listing) => {
      const match = OPENROUTER_ICONS.find(({ prefix }) => listing.id.startsWith(prefix))

      return {
        id: listing.id,
        name: listing.name,
        providerLabel: "OpenCode · OpenRouter",
        source: "opencode",
        icon: match?.icon ?? CpuIcon,
      }
    },
  },
  {
    source: "chatgpt",
    label: "ChatGPT models",
    icon: OpenAILogo,
    bundledModels: BUNDLED_CHATGPT_MODELS,
  },
]

export const CHAT_MODELS: readonly ChatModelOption[] = CHAT_MODEL_PROVIDERS.flatMap(
  (provider) => provider.bundledModels,
)

export function getChatModel(id: string | null | undefined) {
  return CHAT_MODELS.find((model) => model.id === id) ?? CHAT_MODELS[0]
}

export function getChatModelSource(id: string | null | undefined): ChatModelSourceId {
  return getChatModel(id).source
}

export function getChatModelGroupLabel(groupId: ChatModelGroupId) {
  return CHAT_MODEL_GROUPS[groupId].label
}

export function mergeProviderListings(
  bundled: readonly ChatModelOption[],
  listings: ChatModelInfo[],
  mapListing: (listing: ChatModelInfo) => ChatModelOption,
): ChatModelOption[] {
  const knownIds = new Set(bundled.map((model) => model.id))
  const merged = [...bundled]

  for (const listing of listings) {
    if (knownIds.has(listing.id)) continue

    knownIds.add(listing.id)
    merged.push(mapListing(listing))
  }

  return merged
}
