import type { ComponentType } from "react"
import { CpuIcon } from "lucide-react"

import {
  AnthropicLogo,
  DeepSeekLogo,
  ElevenLabsLogo,
  GoogleLogo,
  GroqLogo,
  HuggingFaceLogo,
  MetaLogo,
  MiniMaxLogo,
  MistralLogo,
  MoonshotLogo,
  NvidiaLogo,
  OpenAILogo,
  OpenRouterLogo,
  PerplexityLogo,
  QwenLogo,
  XAILogo,
  XiaomiLogo,
} from "@/components/model-logos"
import {
  isFreeOpenRouterModelId,
  isTextOnlyOutputModel,
  type ChatModelInfo,
  type ChatModelSourceId,
} from "../../../shared/chat-api"

export type { ChatModelSourceId }

export type ChatModelIcon = ComponentType<{ className?: string }>

export type ChatModelOption = {
  id: string
  name: string
  providerLabel: string
  source: ChatModelSourceId
  icon: ChatModelIcon
  unavailableReason?: string
  isFree?: boolean
  popularityRank?: number
  supportsReasoning?: boolean
  supportsEffort?: boolean
  supportsImages?: boolean
  outputModalities?: string[]
  groupId?: ChatModelGroupId
}

export const POPULAR_OPENROUTER_COUNT = 20

export function isFreeChatModel(model: { id: string; isFree?: boolean }) {
  return model.isFree ?? isFreeOpenRouterModelId(model.id)
}

export function supportsReasoningChatModel(model: { supportsReasoning?: boolean }) {
  return model.supportsReasoning === true
}

export function supportsEffortChatModel(model: { supportsEffort?: boolean }) {
  return model.supportsEffort === true
}

export function supportsImagesChatModel(model: { supportsImages?: boolean }) {
  return model.supportsImages === true
}

export function sortChatModelsByPopularity(models: readonly ChatModelOption[]) {
  return [...models].toSorted((a, b) => {
    const rankA = a.popularityRank ?? Number.POSITIVE_INFINITY
    const rankB = b.popularityRank ?? Number.POSITIVE_INFINITY

    if (rankA !== rankB) return rankA - rankB

    return a.name.localeCompare(b.name)
  })
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
  | {
      liveListings: true
      mapListing: (listing: ChatModelInfo) => ChatModelOption
      excludeListing: (listing: ChatModelInfo) => boolean
    }
  | { liveListings?: undefined }
)

const HIDDEN_OPENROUTER_LISTING_PATTERN = /latest|batch/i

function isHiddenOpenRouterListing(listing: ChatModelInfo) {
  return HIDDEN_OPENROUTER_LISTING_PATTERN.test(`${listing.id} ${listing.name}`)
}

function isExcludedOpenRouterListing(listing: ChatModelInfo) {
  return isHiddenOpenRouterListing(listing) || !isTextOnlyOutputModel(listing.outputModalities)
}

const BUNDLED_OPENROUTER_MODELS: ChatModelOption[] = [
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: OpenAILogo,
    supportsReasoning: true,
    supportsEffort: true,
    supportsImages: true,
  },
  {
    id: "openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: OpenAILogo,
    supportsReasoning: true,
    supportsEffort: true,
    supportsImages: true,
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: GoogleLogo,
    supportsReasoning: true,
    supportsEffort: true,
    supportsImages: true,
  },
  {
    id: "x-ai/grok-4.6",
    name: "Grok 4.6",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: XAILogo,
    supportsReasoning: true,
    supportsEffort: true,
    supportsImages: true,
  },
  {
    id: "meta-llama/llama-4-scout",
    name: "Llama 4 Scout 17B",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: MetaLogo,
    supportsReasoning: false,
    supportsImages: true,
  },
  {
    id: "qwen/qwen3-32b",
    name: "Qwen3 32B",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: CpuIcon,
    supportsReasoning: true,
    supportsEffort: true,
    supportsImages: false,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra (free)",
    providerLabel: "OpenRouter",
    source: "openrouter",
    icon: CpuIcon,
    isFree: true,
    supportsReasoning: true,
    supportsEffort: true,
    supportsImages: false,
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
  { prefix: "anthropic/", icon: AnthropicLogo },
  { prefix: "google/", icon: GoogleLogo },
  { prefix: "x-ai/", icon: XAILogo },
  { prefix: "meta-llama/", icon: MetaLogo },
  { prefix: "meta/", icon: MetaLogo },
  { prefix: "deepseek/", icon: DeepSeekLogo },
  { prefix: "qwen/", icon: QwenLogo },
  { prefix: "mistralai/", icon: MistralLogo },
  { prefix: "mistral/", icon: MistralLogo },
  { prefix: "nvidia/", icon: NvidiaLogo },
  { prefix: "perplexity/", icon: PerplexityLogo },
  { prefix: "openrouter/", icon: OpenRouterLogo },
  { prefix: "groq/", icon: GroqLogo },
  { prefix: "minimax/", icon: MiniMaxLogo },
  { prefix: "moonshotai/", icon: MoonshotLogo },
  { prefix: "xiaomi/", icon: XiaomiLogo },
  { prefix: "elevenlabs/", icon: ElevenLabsLogo },
  { prefix: "huggingfaceh4/", icon: HuggingFaceLogo },
  { prefix: "huggingface/", icon: HuggingFaceLogo },
]

const OPENROUTER_COMPANY_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
  huggingfaceh4: "Hugging Face",
  meta: "Meta",
  "meta-llama": "Meta",
  microsoft: "Microsoft",
  minimax: "MiniMax",
  mistral: "Mistral",
  mistralai: "Mistral",
  moonshotai: "Moonshot AI",
  nvidia: "Nvidia",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  qwen: "Qwen",
  "x-ai": "xAI",
}

function humanizeCompanyId(companyId: string) {
  return companyId
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function stripAuthorPrefix(modelId: string, name: string) {
  const separator = name.indexOf(":")

  if (separator <= 0) return name

  const prefix = name.slice(0, separator).trim()
  const remainder = name.slice(separator + 1).trim()

  if (!prefix || !remainder) return name

  const normalizedPrefix = prefix.toLocaleLowerCase().replace(/[^a-z0-9]/g, "")
  const normalizedAuthor = getOpenRouterCompanyId(modelId).replace(/[^a-z0-9]/g, "")

  if (normalizedPrefix.length < 2 || normalizedAuthor.length < 2) return name

  const isAuthorPrefix =
    normalizedPrefix.includes(normalizedAuthor) || normalizedAuthor.includes(normalizedPrefix)

  return isAuthorPrefix ? remainder : name
}

export function getOpenRouterCompanyId(modelId: string) {
  const separator = modelId.indexOf("/")

  if (separator <= 0) return "other"

  // OpenRouter lists some models under a "~"-prefixed slug of the same company
  // (e.g. "~openai/gpt-latest" next to "openai/..."). Treat those as one company.
  return modelId.slice(0, separator).toLocaleLowerCase().replace(/^~+/, "")
}

export function getOpenRouterCompanyLabel(companyId: string) {
  if (companyId === "other") return "Other"

  return OPENROUTER_COMPANY_LABELS[companyId] ?? humanizeCompanyId(companyId)
}

export function getOpenRouterCompanyIcon(companyId: string) {
  const match = OPENROUTER_ICONS.find(({ prefix }) =>
    `${companyId}/`.startsWith(prefix.toLocaleLowerCase()),
  )

  return match?.icon ?? CpuIcon
}

export function groupOpenRouterModelsByCompany(models: readonly ChatModelOption[]) {
  // Key sections by display label so distinct slugs of one company share a section
  // (e.g. "meta" and "meta-llama" both render as "Meta").
  const sections = new Map<string, { id: string; icon: ChatModelIcon; models: ChatModelOption[] }>()

  for (const model of models) {
    const companyId = getOpenRouterCompanyId(model.id)
    const label = getOpenRouterCompanyLabel(companyId)
    const section = sections.get(label)

    if (section) {
      section.models.push(model)

      if (section.icon === CpuIcon && model.icon !== CpuIcon) section.icon = model.icon
    } else {
      sections.set(label, { id: companyId, icon: model.icon, models: [model] })
    }
  }

  const grouped = [...sections].map(([label, section]) => {
    const sortedModels = [...section.models].toSorted((a, b) => a.name.localeCompare(b.name))

    return { id: section.id, label, icon: section.icon, models: sortedModels }
  })

  grouped.sort((a, b) => {
    if (a.label === "Other") return 1
    if (b.label === "Other") return -1

    return a.label.localeCompare(b.label)
  })

  return grouped
}

export const CHAT_MODEL_PROVIDERS: ChatModelProvider[] = [
  {
    source: "openrouter",
    label: "OpenRouter models",
    icon: OpenRouterLogo,
    bundledModels: BUNDLED_OPENROUTER_MODELS,
    liveListings: true,
    excludeListing: isExcludedOpenRouterListing,
    mapListing: (listing) => {
      const companyId = getOpenRouterCompanyId(listing.id)

      return {
        id: listing.id,
        name: stripAuthorPrefix(listing.id, listing.name),
        providerLabel: "OpenRouter",
        source: "openrouter",
        icon: getOpenRouterCompanyIcon(companyId),
        isFree: isFreeChatModel(listing),
        popularityRank: listing.popularityRank,
        supportsReasoning: listing.supportsReasoning,
        supportsEffort: listing.supportsEffort,
        supportsImages: listing.supportsImages,
        outputModalities: listing.outputModalities,
      }
    },
  },
  {
    source: "chatgpt",
    label: "ChatGPT models",
    icon: OpenAILogo,
    bundledModels: BUNDLED_CHATGPT_MODELS.map((model) =>
      Object.assign({}, model, { unavailableReason: "ChatGPT support is not available yet" }),
    ),
  },
]

export function getChatModelGroupLabel(groupId: ChatModelGroupId) {
  return CHAT_MODEL_GROUPS[groupId].label
}

export function mergeProviderListings(
  existingModels: readonly ChatModelOption[],
  listings: ChatModelInfo[],
  mapListing: (listing: ChatModelInfo) => ChatModelOption,
): ChatModelOption[] {
  const listingsById = new Map(listings.map((listing) => [listing.id, listing]))
  const knownIds = new Set(existingModels.map((model) => model.id))
  const merged = existingModels.map((model) => {
    const listing = listingsById.get(model.id)

    if (!listing) return model

    return {
      ...model,
      isFree: isFreeChatModel(listing),
      popularityRank: listing.popularityRank,
      supportsReasoning: listing.supportsReasoning ?? model.supportsReasoning,
      supportsEffort: listing.supportsEffort ?? model.supportsEffort,
      supportsImages: listing.supportsImages ?? model.supportsImages,
      outputModalities: listing.outputModalities ?? model.outputModalities,
    }
  })

  for (const listing of listings) {
    if (knownIds.has(listing.id)) continue

    knownIds.add(listing.id)
    merged.push(mapListing(listing))
  }

  return merged
}
