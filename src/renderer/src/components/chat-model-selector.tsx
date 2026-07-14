import { useEffect, useRef, useState } from "react"
import { useAui } from "@assistant-ui/react"
import { ChevronDownIcon, SearchIcon } from "lucide-react"

import { GoogleLogo, GroqLogo, MetaLogo, OpenAILogo, XAILogo } from "@/components/model-logos"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

const modelOptions = [
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano", provider: "OpenAI", icon: OpenAILogo },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "OpenAI", icon: OpenAILogo },
  {
    id: "google-ai-studio/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    provider: "Google",
    icon: GoogleLogo,
  },
  { id: "grok/grok-4-1-fast", name: "Grok 4.1 Fast", provider: "xAI", icon: XAILogo },
  { id: "grok/grok-3-mini", name: "Grok 3 Mini", provider: "xAI", icon: XAILogo },
  {
    id: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout 17B",
    provider: "Meta",
    icon: MetaLogo,
  },
  { id: "groq/qwen/qwen3-32b", name: "Qwen3 32B", provider: "Groq", icon: GroqLogo },
] as const

export function ChatModelSelector() {
  const api = useAui()
  const filterInputRef = useRef<HTMLInputElement>(null)
  const modelOptionRefs = useRef(new Map<(typeof modelOptions)[number]["id"], HTMLElement>())
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedModel, setSelectedModel] = useState<(typeof modelOptions)[number]>(modelOptions[0])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredModels = modelOptions.filter((model) =>
    model.name.toLocaleLowerCase().includes(normalizedQuery),
  )

  const setDropdownOpen = (open: boolean) => {
    setIsOpen(open)
    if (!open) setQuery("")
  }

  const selectModel = (value: unknown) => {
    const model = modelOptions.find((option) => option.id === value)
    if (model) setSelectedModel(model)
  }

  useEffect(
    () =>
      api.modelContext().register({
        getModelContext: () => ({ config: { modelName: selectedModel.id } }),
      }),
    [api, selectedModel.id],
  )

  const SelectedModelIcon = selectedModel.icon

  return (
    <DropdownMenu open={isOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger
        aria-label="Choose model"
        className="flex h-7 min-w-0 shrink items-center justify-start gap-1 rounded-full px-1.5 text-xs font-medium transition-all outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] data-popup-open:bg-muted"
      >
        <SelectedModelIcon className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{selectedModel.name}</span>
        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" side="top" sideOffset={6}>
        <div className="relative p-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={filterInputRef}
            aria-label="Filter models"
            className="h-8 pl-8 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") return

              event.stopPropagation()

              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault()
                const model =
                  event.key === "ArrowDown"
                    ? filteredModels[0]
                    : filteredModels[filteredModels.length - 1]
                if (model) modelOptionRefs.current.get(model.id)?.focus()
              }
            }}
            placeholder="Filter models..."
            value={query}
          />
        </div>
        <DropdownMenuRadioGroup value={selectedModel.id} onValueChange={selectModel}>
          {filteredModels.map((model) => {
            const ModelIcon = model.icon

            return (
              <DropdownMenuRadioItem
                ref={(element) => {
                  if (element) modelOptionRefs.current.set(model.id, element)
                  else modelOptionRefs.current.delete(model.id)
                }}
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
