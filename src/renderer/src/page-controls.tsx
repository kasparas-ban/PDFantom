import { useEffect, useState, type KeyboardEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { useReaderSession } from "./store/reader-session-provider"

export function PageControls() {
  const currentPage = useReaderSession((state) => state.currentPage)
  const pageCount = useReaderSession((state) => state.pageCount)
  const requestPage = useReaderSession((state) => state.requestPage)

  const [pageNumber, setPageNumber] = useState(String(currentPage))

  useEffect(() => setPageNumber(String(currentPage)), [currentPage])

  const commitPageNumber = () => {
    const requestedPage = Number(pageNumber)
    const nextPage = requestPage(requestedPage)

    setPageNumber(String(nextPage))
  }

  const handlePageNumberKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return

    commitPageNumber()
    event.currentTarget.blur()
  }

  return (
    <div
      className="flex items-center rounded-lg border border-border/80 bg-muted/50 p-0.5 shadow-xs"
      aria-label="Page controls"
    >
      <Button
        aria-label="Previous page"
        className="size-6 rounded-md"
        disabled={currentPage <= 1}
        onClick={() => requestPage(currentPage - 1)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ChevronLeft />
      </Button>
      <div className="flex items-center gap-1 px-1.5 text-[0.72rem] text-muted-foreground tabular-nums">
        <Input
          aria-label="Page number"
          autoComplete="off"
          className="h-5 w-8 [appearance:textfield] rounded-sm border-border/80 bg-background px-1 text-center text-[0.72rem] text-foreground shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          disabled={pageCount === 0}
          max={pageCount || undefined}
          min={1}
          onBlur={commitPageNumber}
          onChange={(event) => setPageNumber(event.target.value)}
          onClick={(event) => event.currentTarget.select()}
          onKeyDown={handlePageNumberKeyDown}
          type="number"
          value={pageNumber}
        />
        <span>of {pageCount || "-"}</span>
      </div>
      <Button
        aria-label="Next page"
        className="size-6 rounded-md"
        disabled={pageCount === 0 || currentPage >= pageCount}
        onClick={() => requestPage(currentPage + 1)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
