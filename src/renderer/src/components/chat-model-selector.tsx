import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { ChevronDownIcon, CpuIcon, SearchIcon } from "lucide-react"

import { GoogleLogo, MetaLogo, OpenAILogo, XAILogo } from "@/components/model-logos"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { usePagePortalContainer } from "../app/page-surface"
import { useChatModel } from "../sidebar/chat-session"

const modelOptions = [
  { id: "openai/gpt-5.4-nano", name: "GPT-5.4 Nano", provider: "OpenAI", icon: OpenAILogo },
  { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "OpenAI", icon: OpenAILogo },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    provider: "Google",
    icon: GoogleLogo,
  },
  { id: "x-ai/grok-4.6", name: "Grok 4.6", provider: "xAI", icon: XAILogo },
  {
    id: "meta-llama/llama-4-scout",
    name: "Llama 4 Scout 17B",
    provider: "Meta",
    icon: MetaLogo,
  },
  { id: "qwen/qwen3-32b", name: "Qwen3 32B", provider: "Qwen", icon: CpuIcon },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra (free)",
    provider: "NVIDIA",
    icon: CpuIcon,
  },
] as const

type ModelId = (typeof modelOptions)[number]["id"]

export function ChatModelSelector() {
  const { model: modelId, setModel } = useChatModel()
  const portalContainer = usePagePortalContainer()
  const shouldRestoreFocus = useRef(false)
  const modelOptionRefs = useRef(new Map<ModelId, HTMLElement>())
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selectedModel = modelOptions.find((option) => option.id === modelId) ?? modelOptions[0]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredModels = modelOptions.filter((model) =>
    model.name.toLocaleLowerCase().includes(normalizedQuery),
  )

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) setQuery("")
  }

  const handleModelChange = (value: unknown) => {
    const model = modelOptions.find((option) => option.id === value)
    if (!model) return

    setModel(model.id)
  }

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return

    event.stopPropagation()

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return

    event.preventDefault()
    const modelToFocus =
      event.key === "ArrowDown" ? filteredModels[0] : filteredModels[filteredModels.length - 1]
    if (!modelToFocus) return

    modelOptionRefs.current.get(modelToFocus.id)?.focus()
  }

  const setModelOptionRef = (id: ModelId, element: HTMLElement | null) => {
    if (!element) {
      modelOptionRefs.current.delete(id)
      return
    }

    modelOptionRefs.current.set(id, element)
  }

  useLayoutEffect(() => {
    shouldRestoreFocus.current = true
    setIsOpen(false)
    setQuery("")

    return () => {
      shouldRestoreFocus.current = false
    }
  }, [])

  const SelectedModelIcon = selectedModel.icon

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        aria-label="Choose model"
        className="flex h-7 min-w-0 shrink items-center justify-start gap-1 rounded-full px-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform,translate,scale] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] data-popup-open:bg-muted"
      >
        <SelectedModelIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{selectedModel.name}</span>
        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        finalFocus={() => shouldRestoreFocus.current}
        align="start"
        className="w-64"
        portalContainer={portalContainer}
        side="top"
        sideOffset={6}
      >
        <div className="relative p-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Filter models"
            className="h-8 pl-8 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder="Filter models..."
            value={query}
          />
        </div>
        <DropdownMenuRadioGroup value={selectedModel.id} onValueChange={handleModelChange}>
          {filteredModels.map((model) => {
            const ModelIcon = model.icon

            return (
              <DropdownMenuRadioItem
                ref={(element) => setModelOptionRef(model.id, element)}
                closeOnClick
                key={model.id}
                value={model.id}
              >
                <ModelIcon className="size-4" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{model.name}</span>
                  <span aria-hidden="true" className="truncate text-xs text-muted-foreground">
                    {model.provider}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            )
          })}
          {filteredModels.length === 0 && (
            <output className="block px-2 py-4 text-center text-xs text-muted-foreground">
              No models found.
            </output>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
