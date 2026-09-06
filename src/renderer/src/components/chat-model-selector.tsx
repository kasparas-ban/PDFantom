import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { ChevronDownIcon, ChevronRightIcon, SearchIcon, StarIcon } from "lucide-react"

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
  CHAT_MODEL_PROVIDERS,
  getChatModelGroupLabel,
  getOpenRouterCompanyId,
  getOpenRouterCompanyLabel,
  groupOpenRouterModelsByCompany,
  type ChatModelGroupId,
  type ChatModelIcon,
  type ChatModelOption,
  type ChatModelSourceId,
} from "../sidebar/chat-models"
import { useChatModel } from "../sidebar/chat-session"

type ModelTab = ChatModelSourceId | "favorites"

const RAIL_TABS = [
  { id: "favorites" as const, label: "Favorite models", Icon: StarIcon },
  ...CHAT_MODEL_PROVIDERS.map((provider) => ({
    id: provider.source,
    label: provider.label,
    Icon: provider.icon,
  })),
]

type ModelListRow =
  | { kind: "model"; model: ChatModelOption }
  | { kind: "group"; id: ChatModelGroupId; label: string; count: number }
  | { kind: "company"; id: string; label: string; icon: ChatModelIcon; models: ChatModelOption[] }

function appendGroupedRows(
  rows: ModelListRow[],
  grouped: [ChatModelGroupId, ChatModelOption[]][],
  revealed: ChatModelGroupId[],
  isFiltering: boolean,
) {
  for (const [id, models] of grouped) {
    if (!revealed.includes(id) && !isFiltering) {
      rows.push({ kind: "group", id, label: getChatModelGroupLabel(id), count: models.length })
      continue
    }

    for (const model of models) rows.push({ kind: "model", model })
  }
}

function buildModelRows(
  primary: ChatModelOption[],
  grouped: [ChatModelGroupId, ChatModelOption[]][],
  revealed: ChatModelGroupId[],
  isFiltering: boolean,
) {
  const rows: ModelListRow[] = []

  for (const model of primary) rows.push({ kind: "model", model })

  appendGroupedRows(rows, grouped, revealed, isFiltering)

  return rows
}

function buildOpenRouterRows(
  primary: ChatModelOption[],
  grouped: [ChatModelGroupId, ChatModelOption[]][],
  revealed: ChatModelGroupId[],
  isFiltering: boolean,
) {
  const rows: ModelListRow[] = []

  for (const section of groupOpenRouterModelsByCompany(primary)) {
    rows.push({
      kind: "company",
      id: section.id,
      label: section.label,
      icon: section.icon,
      models: section.models,
    })
  }

  appendGroupedRows(rows, grouped, revealed, isFiltering)

  return rows
}

export function ChatModelSelector() {
  const { selectedModel, setModel, favoriteModelIds, toggleFavorite, models } = useChatModel()
  const portalContainer = usePagePortalContainer()
  const shouldRestoreFocus = useRef(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const modelOptionRefs = useRef(new Map<string, HTMLElement>())
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<ModelTab>(selectedModel.source)
  const [revealedGroups, setRevealedGroups] = useState<ChatModelGroupId[]>([])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const isFiltering = normalizedQuery.length > 0

  const matchesQuery = (model: ChatModelOption) =>
    model.name.toLocaleLowerCase().includes(normalizedQuery) ||
    model.providerLabel.toLocaleLowerCase().includes(normalizedQuery) ||
    model.id.toLocaleLowerCase().includes(normalizedQuery) ||
    getOpenRouterCompanyLabel(getOpenRouterCompanyId(model.id))
      .toLocaleLowerCase()
      .includes(normalizedQuery)

  const getBaseModels = (): ChatModelOption[] => {
    if (activeTab === "favorites") {
      return models.filter((model) => favoriteModelIds.includes(model.id))
    }

    return models.filter((model) => model.source === activeTab && !model.groupId)
  }

  const primaryModels = getBaseModels().filter(matchesQuery)

  const groupedModels = new Map<ChatModelGroupId, ChatModelOption[]>()

  if (activeTab !== "favorites") {
    for (const model of models) {
      if (model.source !== activeTab || !model.groupId || !matchesQuery(model)) continue

      const group = groupedModels.get(model.groupId)

      if (group) {
        group.push(model)
      } else {
        groupedModels.set(model.groupId, [model])
      }
    }
  }

  const rows =
    activeTab === "openrouter"
      ? buildOpenRouterRows(primaryModels, [...groupedModels], revealedGroups, isFiltering)
      : buildModelRows(primaryModels, [...groupedModels], revealedGroups, isFiltering)
  const visibleModels = rows.flatMap((row) =>
    row.kind === "model" ? [row.model] : row.kind === "company" ? row.models : [],
  )
  const selectableModels = visibleModels.filter((model) => !model.unavailableReason)
  const shortcutModels = selectableModels.slice(0, 9)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)

    if (open) {
      setActiveTab(selectedModel.source)
      setRevealedGroups(selectedModel.groupId ? [selectedModel.groupId] : [])
    } else {
      setQuery("")
      setRevealedGroups([])
    }
  }

  const handleModelChange = (value: unknown) => {
    if (typeof value === "string") setModel(value)
  }

  const handleFavoriteClick = (event: MouseEvent, model: ChatModelOption) => {
    event.stopPropagation()
    event.preventDefault()
    toggleFavorite(model.id)
  }

  const revealGroup = (groupId: ChatModelGroupId) =>
    setRevealedGroups((revealed) =>
      revealed.includes(groupId) ? revealed : [...revealed, groupId],
    )

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return

    if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
      const modelToSelect = shortcutModels[Number.parseInt(event.key, 10) - 1]
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
      event.key === "ArrowDown"
        ? selectableModels[0]
        : selectableModels[selectableModels.length - 1]
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

  const renderModelRow = (model: ChatModelOption) => {
    const isFavorite = favoriteModelIds.includes(model.id)
    const shortcutIndex = shortcutModels.indexOf(model)

    return (
      <div className="relative flex items-center" key={model.id}>
        <DropdownMenuRadioItem
          ref={(element) => setModelOptionRef(model.id, element)}
          className="min-w-0 flex-1 py-2 pr-24 pl-2"
          closeOnClick
          disabled={Boolean(model.unavailableReason)}
          title={model.unavailableReason}
          value={model.id}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{model.name}</span>
            {model.unavailableReason && (
              <span className="truncate text-xs text-muted-foreground">
                {model.unavailableReason}
              </span>
            )}
          </span>
        </DropdownMenuRadioItem>

        <div className="pointer-events-none absolute right-16 flex items-center">
          {shortcutIndex >= 0 && (
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              ⌘{shortcutIndex + 1}
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

  const renderGroupRow = (group: { id: ChatModelGroupId; label: string; count: number }) => (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      key={group.id}
      onClick={() => revealGroup(group.id)}
      type="button"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{group.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {group.count} {group.count === 1 ? "model" : "models"}
        </span>
      </span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )

  const renderCompanySection = (section: {
    id: string
    label: string
    icon: ChatModelIcon
    models: ChatModelOption[]
  }) => {
    const Icon = section.icon

    return (
      <div className="mt-3 pb-1 first:mt-0 first:pt-1" key={`company-${section.id}`}>
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{section.label}</span>
        </div>

        {section.models.map((model) => renderModelRow(model))}
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

  const SelectedModelIcon = selectedModel.icon

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(open) => {
        if (open) searchRef.current?.focus()
      }}
    >
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
          <fieldset
            aria-label="Model sources"
            className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border/60 py-2"
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
                    <Icon className={cn("size-5", isStar && isActive && "fill-current")} />
                  </button>
                </div>
              )
            })}
          </fieldset>

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
              {rows.map((row) => {
                if (row.kind === "model") return renderModelRow(row.model)
                if (row.kind === "company") return renderCompanySection(row)

                return renderGroupRow(row)
              })}

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
