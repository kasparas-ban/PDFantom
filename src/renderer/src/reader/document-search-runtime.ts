import type { PDFDocumentProxy } from "pdfjs-dist"
import {
  EventBus,
  FindState,
  PDFFindController,
  PDFLinkService,
  type PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs"

export type DocumentSearchUpdate = {
  readonly query: string
  readonly phase: "searching" | "found" | "not-found"
  readonly current: number
  readonly total: number
  readonly wrapped: boolean
}

type SearchMatchCount = Pick<DocumentSearchUpdate, "current" | "total">

export function createDocumentSearchAdapter({
  eventBus,
  onChange,
}: {
  readonly eventBus: EventBus
  readonly onChange: (update: DocumentSearchUpdate) => void
}) {
  const linkService = new PDFLinkService({ eventBus })
  const findController = new PDFFindController({ eventBus, linkService })
  let query = ""
  let phase: DocumentSearchUpdate["phase"] = "searching"

  const report = (nextPhase: DocumentSearchUpdate["phase"], count: SearchMatchCount, wrapped = false) => {
    if (!query) return

    phase = nextPhase
    onChange({ query, phase, ...count, wrapped })
  }

  const handleControlState = ({
    state,
    matchesCount,
    rawQuery,
  }: {
    state: number
    matchesCount: SearchMatchCount
    rawQuery: string | null
  }) => {
    if (!query || rawQuery !== query) return

    if (state === FindState.PENDING) {
      report("searching", matchesCount)
    } else if (state === FindState.NOT_FOUND) {
      report("not-found", matchesCount)
    } else {
      report("found", matchesCount, state === FindState.WRAPPED)
    }
  }

  const handleMatchCount = ({ matchesCount }: { matchesCount: SearchMatchCount }) =>
    report(phase, matchesCount)

  const dispatch = (type: "again" | undefined, findPrevious = false) => {
    if (!query) return

    eventBus.dispatch("find", {
      source: null,
      type,
      query,
      phraseSearch: true,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
      matchDiacritics: false,
    })
  }

  const hide = () => eventBus.dispatch("findbarclose", { source: null })

  eventBus.on("updatefindcontrolstate", handleControlState)
  eventBus.on("updatefindmatchescount", handleMatchCount)

  return {
    findController,
    linkService,
    connect: (viewer: PDFViewer, document: PDFDocumentProxy) => {
      linkService.setViewer(viewer)
      linkService.setDocument(document)
    },
    update: (nextQuery: string) => {
      query = nextQuery
      phase = "searching"

      if (query) {
        dispatch(undefined)
      } else {
        hide()
      }
    },
    move: (previous: boolean) => dispatch("again", previous),
    hide,
    close: () => {
      query = ""
      hide()
    },
    dispose: () => {
      query = ""
      hide()
      eventBus.off("updatefindcontrolstate", handleControlState)
      eventBus.off("updatefindmatchescount", handleMatchCount)
    },
  }
}
