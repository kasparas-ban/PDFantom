import { EMPTY_SEARCH_SNAPSHOT, type SearchSnapshot } from "../search"
import type { ChatPanelMode } from "./chat-thread-store"

const SEARCH_TEXT_SELECTOR = "[data-chat-search-text]"
const SEARCH_SEPARATOR_SELECTOR =
  "button, [aria-hidden='true']:not(.katex-html), [hidden], [data-chat-search-exclude]"
const SEARCH_EXCLUDED_SELECTOR = `${SEARCH_SEPARATOR_SELECTOR}, .katex-mathml`
const BLOCK_SELECTOR =
  "address, article, aside, blockquote, div, dl, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, td, th, tr, ul"
const CURRENT_ATTRIBUTE = "data-chat-search-current"
const DIACRITIC = /\p{Mark}/u

type TextOffset = {
  readonly node: Text
  readonly offset: number
}

type NormalizedDomText = {
  text: string
  starts: TextOffset[]
  ends: TextOffset[]
}

type NormalizedChatSearchText = {
  readonly text: string
  readonly starts: readonly number[]
  readonly ends: readonly number[]
}

export function normalizeChatSearchText(source: string) {
  let text = ""
  const starts: number[] = []
  const ends: number[] = []

  for (let offset = 0; offset < source.length; ) {
    const character = String.fromCodePoint(source.codePointAt(offset)!)
    const end = offset + character.length

    if (/\s/u.test(character)) {
      if (text.endsWith(" ")) {
        ends[ends.length - 1] = end
      } else {
        text += " "
        starts.push(offset)
        ends.push(end)
      }

      offset = end
      continue
    }

    const normalized = Array.from(character.normalize("NFD"))
      .filter((part) => !DIACRITIC.test(part))
      .join("")
      .toLowerCase()

    if (!normalized) {
      if (ends.length > 0) ends[ends.length - 1] = end

      offset = end
      continue
    }

    text += normalized
    for (let index = 0; index < normalized.length; index += 1) {
      starts.push(offset)
      ends.push(end)
    }

    offset = end
  }

  return { text, starts, ends }
}

export function createChatSearchController(mode: ChatPanelMode) {
  const highlightNames = {
    all: `pdfantom-chat-search-${mode}`,
    current: `pdfantom-chat-search-${mode}-current`,
  }
  const listeners = new Set<() => void>()
  let snapshot = EMPTY_SEARCH_SNAPSHOT
  let viewport: HTMLElement | null = null
  let frame = 0
  let query = ""
  let ranges: Range[] = []
  let currentIndex = 0

  const publish = (update: Partial<SearchSnapshot>) => {
    snapshot = { ...snapshot, ...update }
    for (const listener of listeners) listener()
  }

  const clearPresentation = () => {
    CSS.highlights.delete(highlightNames.all)
    CSS.highlights.delete(highlightNames.current)

    if (!viewport) return

    for (const element of viewport.querySelectorAll(`[${CURRENT_ATTRIBUTE}]`)) {
      element.removeAttribute(CURRENT_ATTRIBUTE)
    }
  }

  const present = (wrapped = false, scroll = false) => {
    clearPresentation()

    if (viewport && ranges.length > 0) {
      const current = ranges[currentIndex]
      CSS.highlights.set(highlightNames.all, new Highlight(...ranges))
      CSS.highlights.set(highlightNames.current, new Highlight(current))

      current.startContainer.parentElement
        ?.closest(SEARCH_TEXT_SELECTOR)
        ?.setAttribute(CURRENT_ATTRIBUTE, "true")

      if (scroll) scrollRangeIntoView(current, viewport)
    }

    const phase = query ? (ranges.length > 0 ? "found" : "not-found") : "idle"
    publish({
      phase,
      current: ranges.length > 0 ? currentIndex + 1 : 0,
      total: ranges.length,
      wrapped,
    })
  }

  const rebuild = (scroll = false) => {
    if (!snapshot.visible || !viewport) return

    ranges = query ? findRanges(viewport, query) : []
    currentIndex = Math.min(currentIndex, Math.max(0, ranges.length - 1))
    present(false, scroll)
  }

  const cancelRefresh = () => {
    cancelAnimationFrame(frame)
    frame = 0
  }

  const scheduleRefresh = () => {
    if (!snapshot.visible || frame) return

    frame = requestAnimationFrame(() => {
      frame = 0
      rebuild()
    })
  }

  const close = () => {
    cancelRefresh()
    clearPresentation()
    ranges = []
    currentIndex = 0
    publish({
      visible: false,
      phase: "idle",
      current: 0,
      total: 0,
      wrapped: false,
    })
  }

  return {
    close,
    connect: (element: HTMLElement) => {
      viewport = element
      const nextObserver = new MutationObserver(scheduleRefresh)
      nextObserver.observe(element, { childList: true, characterData: true, subtree: true })
      if (snapshot.visible) rebuild()

      return () => {
        nextObserver.disconnect()
        if (viewport !== element) return

        cancelRefresh()
        clearPresentation()
        ranges = []
        viewport = null
      }
    },
    getSnapshot: () => snapshot,
    move: (previous: boolean) => {
      if (!snapshot.visible || ranges.length === 0) return

      const lastIndex = ranges.length - 1
      const wrapped = previous ? currentIndex === 0 : currentIndex === lastIndex
      currentIndex = previous
        ? (currentIndex + lastIndex) % ranges.length
        : (currentIndex + 1) % ranges.length
      present(wrapped, true)
    },
    open: () => {
      publish({ visible: true, phase: query ? "searching" : "idle" })
      rebuild(true)
    },
    reset: () => {
      cancelRefresh()
      clearPresentation()
      query = ""
      ranges = []
      currentIndex = 0
      snapshot = EMPTY_SEARCH_SNAPSHOT
      for (const listener of listeners) listener()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update: (nextQuery: string) => {
      cancelRefresh()
      query = normalizeChatSearchText(nextQuery).text.trim()
      ranges = []
      currentIndex = 0
      publish({
        query: nextQuery,
        phase: query ? "searching" : "idle",
        current: 0,
        total: 0,
        wrapped: false,
      })
      rebuild(true)
    },
  }
}

function findRanges(viewport: HTMLElement, query: string) {
  const ranges: Range[] = []

  for (const boundary of viewport.querySelectorAll<HTMLElement>(SEARCH_TEXT_SELECTOR)) {
    const normalized = normalizeDomText(boundary)

    for (let start = normalized.text.indexOf(query); start !== -1; ) {
      const end = start + query.length
      const range = boundary.ownerDocument.createRange()
      const first = normalized.starts[start]
      const last = normalized.ends[end - 1]

      range.setStart(first.node, first.offset)
      range.setEnd(last.node, last.offset)
      ranges.push(range)
      start = normalized.text.indexOf(query, end)
    }
  }

  return ranges
}

function normalizeDomText(boundary: HTMLElement) {
  const normalized: NormalizedDomText = { text: "", starts: [], ends: [] }
  const walker = boundary.ownerDocument.createTreeWalker(boundary, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent || parent.closest(SEARCH_TEXT_SELECTOR) !== boundary) {
        return NodeFilter.FILTER_REJECT
      }

      return parent.closest(SEARCH_EXCLUDED_SELECTOR)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    },
  })
  let previous: Text | null = null

  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (!(current instanceof Text)) continue

    const node = current
    const chunk = normalizeChatSearchText(node.data)

    if (!chunk.text) {
      if (normalized.ends.length > 0 && node.data) {
        normalized.ends[normalized.ends.length - 1] = { node, offset: node.data.length }
      }

      previous = node
      continue
    }

    if (
      previous &&
      needsBoundarySpace(previous, node) &&
      !normalized.text.endsWith(" ") &&
      !chunk.text.startsWith(" ")
    ) {
      normalized.text += " "
      normalized.starts.push({ node: previous, offset: previous.data.length })
      normalized.ends.push({ node, offset: 0 })
    }

    appendChunk(normalized, chunk, node)
    previous = node
  }

  return normalized
}

function appendChunk(target: NormalizedDomText, chunk: NormalizedChatSearchText, node: Text) {
  let start = 0

  if (target.text.endsWith(" ") && chunk.text.startsWith(" ")) {
    target.ends[target.ends.length - 1] = { node, offset: chunk.ends[0] }
    start = 1
  }

  target.text += chunk.text.slice(start)

  for (let index = start; index < chunk.text.length; index += 1) {
    target.starts.push({ node, offset: chunk.starts[index] })
    target.ends.push({ node, offset: chunk.ends[index] })
  }
}

function needsBoundarySpace(previous: Text, current: Text) {
  if (
    previous.parentElement?.closest(BLOCK_SELECTOR) !==
    current.parentElement?.closest(BLOCK_SELECTOR)
  ) {
    return true
  }

  const between = previous.ownerDocument.createRange()
  between.setStart(previous, previous.data.length)
  between.setEnd(current, 0)

  return Boolean(between.cloneContents().querySelector(`br, ${SEARCH_SEPARATOR_SELECTOR}`))
}

function scrollRangeIntoView(range: Range, viewport: HTMLElement) {
  const match = range.getBoundingClientRect()
  const viewportBounds = viewport.getBoundingClientRect()
  const searchBounds = viewport.parentElement
    ?.querySelector<HTMLElement>("[data-slot='chat-search']")
    ?.getBoundingClientRect()
  const visibleTop = Math.max(viewportBounds.top, searchBounds?.bottom ?? viewportBounds.top) + 8
  const visibleBottom = viewportBounds.bottom - 8

  if (match.top < visibleTop) {
    viewport.scrollBy({ top: match.top - visibleTop })
  } else if (match.bottom > visibleBottom) viewport.scrollBy({ top: match.bottom - visibleBottom })
}
