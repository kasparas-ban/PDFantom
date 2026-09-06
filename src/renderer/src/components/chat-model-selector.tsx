import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { ChevronDownIcon, ChevronRightIcon, SearchIcon, StarIcon } from "lucide-react"

import { OpenAILogo, OpenCodeLogo } from "@/components/model-logos"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { usePagePortalContainer } from "../app/page-surface"
import {
  CHAT_MODELS,
  getChatModel,
  getChatModelSource,
  type ChatModelOption,
  type ChatModelSourceId,
} from "../sidebar/chat-models"
import { useChatModel } from "../sidebar/chat-session"

type ModelTab = ChatModelSourceId | "favorites"

const RAIL_TABS = [
  { id: "favorites" as const, label: "Favorite models", Icon: StarIcon },
  { id: "opencode" as const, label: "OpenCode models", Icon: OpenCodeLogo },
  { id: "chatgpt" as const, label: "ChatGPT models", Icon: OpenAILogo },
]

function SourceGlyph({ model, className }: { model: ChatModelOption; className?: string }) {
  if (model.source === "chatgpt") return <OpenAILogo className={className} />

  return <OpenCodeLogo className={className} />
}

export function ChatModelSelector() {
  const { model: modelId, setModel, favoriteModelIds, toggleFavorite } = useChatModel()
  const portalContainer = usePagePortalContainer()
  const shouldRestoreFocus = useRef(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const modelOptionRefs = useRef(new Map<string, HTMLElement>())
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<ModelTab>(() => getChatModelSource(modelId))
  const [isLegacyExpanded, setIsLegacyExpanded] = useState(false)

  const selectedModel = getChatModel(modelId)

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const isFiltering = normalizedQuery.length > 0

  const matchesQuery = (model: ChatModelOption) =>
    model.name.toLocaleLowerCase().includes(normalizedQuery) ||
    model.providerLabel.toLocaleLowerCase().includes(normalizedQuery)

  const primaryModels = (
    activeTab === "favorites"
      ? CHAT_MODELS.filter((model) => favoriteModelIds.includes(model.id))
      : CHAT_MODELS.filter((model) => model.source === activeTab && !model.legacy)
  ).filter(matchesQuery)

  const legacyFiltered = CHAT_MODELS.filter(
    (model) => model.source === "chatgpt" && model.legacy && matchesQuery(model),
  )

  const showLegacyGroup =
    activeTab === "chatgpt" && (legacyFiltered.length > 0 || !isFiltering)

  const legacyVisible =
    showLegacyGroup && (isLegacyExpanded || isFiltering) ? legacyFiltered : []

  const visibleModels =
    activeTab === "chatgpt" ? [...primaryModels, ...legacyVisible] : primaryModels

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)

    if (open) {
      const selected = getChatModel(modelId)

      setActiveTab(selected.source)
      setIsLegacyExpanded(selected.source === "chatgpt" && selected.legacy === true)
    } else {
      setQuery("")
    }
  }

  const handleModelChange = (value: unknown) => {
    const model = CHAT_MODELS.find((option) => option.id === value)
    if (!model) return

    setModel(model.id)
  }

  const handleFavoriteClick = (event: MouseEvent, model: ChatModelOption) => {
    event.stopPropagation()
    event.preventDefault()
    toggleFavorite(model.id)
  }

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return

    if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
      const modelToSelect = visibleModels[Number.parseInt(event.key, 10) - 1]
      if (!modelToSelect) return

      event.preventDefault()
      event.stopPropagation()
      setModel(modelToSelect.id)

      return
    }

    event.stopPropagation()

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return

    event.preventDefault()
    const modelToFocus =
      event.key === "ArrowDown" ? visibleModels[0] : visibleModels[visibleModels.length - 1]
    if (!modelToFocus) return

    modelOptionRefs.current.get(modelToFocus.id)?.focus()
  }

  const setModelOptionRef = (id: string, element: HTMLElement | null) => {
    if (!element) {
      modelOptionRefs.current.delete(id)
      return
    }

    modelOptionRefs.current.set(id, element)
  }

  const renderModelRow = (model: ChatModelOption, index: number) => {
    const isFavorite = favoriteModelIds.includes(model.id)

    return (
      <div className="relative flex items-center" key={model.id}>
        <DropdownMenuRadioItem
          ref={(element) => setModelOptionRef(model.id, element)}
          className="min-w-0 flex-1 py-2 pr-24 pl-2"
          closeOnClick
          value={model.id}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{model.name}</span>
            <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <SourceGlyph className="size-3.5 shrink-0" model={model} />
              <span aria-hidden="true" className="truncate">
                {model.providerLabel}
              </span>
            </span>
          </span>
        </DropdownMenuRadioItem>

        <div className="pointer-events-none absolute right-16 flex items-center">
          {index < 9 && (
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              ⌘{index + 1}
            </kbd>
          )}
        </div>

        <button
          aria-label={isFavorite ? `Unfavorite ${model.name}` : `Favorite ${model.name}`}
          aria-pressed={isFavorite}
          className={cn(
            "absolute right-8 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            isFavorite && "text-foreground",
          )}
          onClick={(event) => handleFavoriteClick(event, model)}
          title={isFavorite ? `Unfavorite ${model.name}` : `Favorite ${model.name}`}
          type="button"
        >
          <StarIcon className={cn("size-3.5", isFavorite && "fill-current")} />
        </button>
      </div>
    )
  }

  useLayoutEffect(() => {
    shouldRestoreFocus.current = true
    setIsOpen(false)
    setQuery("")

    return () => {
      shouldRestoreFocus.current = false
    }
  }, [])

  useEffect(() => {
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

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
        className="h-[380px] w-[26rem] max-w-[calc(var(--available-width)-1rem)] p-0"
        portalContainer={portalContainer}
        side="top"
        sideOffset={6}
      >
        <div className="flex h-full overflow-hidden">
          <div
            aria-label="Model sources"
            className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border/60 py-2"
            role="group"
          >
            {RAIL_TABS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id
              const isStar = id === "favorites"

              return (
                <div className="relative flex w-full justify-center" key={id}>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 -right-px h-6 w-[3px] -translate-y-1/2 rounded-full bg-blue-600"
                    />
                  )}
                  <button
                    aria-label={label}
                    aria-pressed={isActive}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive && "bg-accent text-foreground",
                    )}
                    onClick={() => setActiveTab(id)}
                    title={label}
                    type="button"
                  >
                    <Icon
                      className={cn("size-5", isStar && isActive && "fill-current")}
                    />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative border-b border-border/60 p-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Filter models"
                className="h-8 border-0 bg-transparent pl-8 text-sm shadow-none focus-visible:ring-0"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleFilterKeyDown}
                placeholder="Search models..."
                ref={searchRef}
                value={query}
              />
            </div>

            <DropdownMenuRadioGroup
              className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1"
              value={selectedModel.id}
              onValueChange={handleModelChange}
            >
              {primaryModels.map((model, index) => renderModelRow(model, index))}

              {showLegacyGroup && (
                <button
                  aria-expanded={isLegacyExpanded || isFiltering}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => setIsLegacyExpanded((expanded) => !expanded)}
                  type="button"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">Legacy models</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {legacyFiltered.length} {legacyFiltered.length === 1 ? "model" : "models"}
                    </span>
                  </span>
                  <ChevronRightIcon
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      (isLegacyExpanded || isFiltering) && "rotate-90",
                    )}
                  />
                </button>
              )}

              {legacyVisible.map((model, legacyIndex) =>
                renderModelRow(model, primaryModels.length + legacyIndex),
              )}

              {visibleModels.length === 0 && (
                <output className="m-auto block px-2 text-center text-xs text-muted-foreground">
                  {activeTab === "favorites" && !isFiltering
                    ? "No favorites yet. Star models to pin them here."
                    : "No models found."}
                </output>
              )}
            </DropdownMenuRadioGroup>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
