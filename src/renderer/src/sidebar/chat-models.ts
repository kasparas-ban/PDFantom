import type { ComponentType } from "react"
import { CpuIcon } from "lucide-react"

import { GoogleLogo, MetaLogo, OpenAILogo, XAILogo } from "@/components/model-logos"

export type ChatModelSourceId = "opencode" | "chatgpt"

export type ChatModelIcon = ComponentType<{ className?: string }>

export type ChatModelOption = {
  id: string
  name: string
  providerLabel: string
  source: ChatModelSourceId
  icon: ChatModelIcon
  legacy?: boolean
}

export const CHAT_MODEL_SOURCES: {
  id: ChatModelSourceId
  label: string
}[] = [
  { id: "opencode", label: "OpenCode models" },
  { id: "chatgpt", label: "ChatGPT models" },
]

export const CHAT_MODELS: readonly ChatModelOption[] = [
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
    legacy: true,
  },
  {
    id: "chatgpt/gpt-5.4-mini",
    name: "GPT-5.4-Mini",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
    legacy: true,
  },
  {
    id: "chatgpt/gpt-5.4",
    name: "GPT-5.4",
    providerLabel: "Codex",
    source: "chatgpt",
    icon: OpenAILogo,
    legacy: true,
  },
]

export function getChatModel(id: string | null | undefined) {
  return CHAT_MODELS.find((model) => model.id === id) ?? CHAT_MODELS[0]
}

export function getChatModelSource(id: string | null | undefined): ChatModelSourceId {
  return getChatModel(id).source
}
