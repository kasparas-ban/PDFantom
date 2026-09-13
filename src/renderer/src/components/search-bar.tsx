import type { RefObject } from "react"
import { ChevronDown, ChevronUp, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { SearchState } from "@/search"

type SearchBarProps = {
  readonly ariaLabel: string
  readonly className?: string
  readonly inputLabel: string
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onClose: () => void
  readonly onMove: (previous: boolean) => void
  readonly onQueryChange: (query: string) => void
  readonly search: SearchState
  readonly slot: string
}

export function SearchBar({
  ariaLabel,
  className,
  inputLabel,
  inputRef,
  onClose,
  onMove,
  onQueryChange,
  search,
  slot,
}: SearchBarProps) {
  let count = ""
  let announcement = ""

  if (search.query) {
    count = search.phase === "searching" ? "Searching…" : `${search.current} / ${search.total}`
  }

  if (search.phase === "searching") {
    announcement = "Searching"
  } else if (search.phase === "not-found") {
    announcement = "No matches"
  } else if (search.wrapped) announcement = "Search wrapped"

  return (
    <search
      aria-label={ariaLabel}
      className={cn("window-no-drag @container", className)}
      data-search-visible="true"
      data-slot={slot}
    >
      <div className="flex w-full flex-wrap items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
        <div className="flex min-w-0 flex-1 items-center @max-[260px]:basis-full">
          <Input
            aria-label={inputLabel}
            autoComplete="off"
            className="h-7 min-w-20 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent [&::-webkit-search-cancel-button]:appearance-none"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return

              event.preventDefault()
              onMove(event.shiftKey)
            }}
            ref={inputRef}
            type="search"
            value={search.query}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <output
            aria-label="Search match count"
            className="min-w-16 text-center text-xs whitespace-nowrap text-muted-foreground"
          >
            {count}
          </output>
          <Separator aria-hidden="true" className="mx-1 bg-border/60" orientation="vertical" />
          <Button
            aria-label="Previous match"
            disabled={!search.current}
            onClick={() => onMove(true)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronUp />
          </Button>
          <Button
            aria-label="Next match"
            disabled={!search.current}
            onClick={() => onMove(false)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronDown />
          </Button>
          <Button
            aria-label="Close search"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
      </div>
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
    </search>
  )
}
