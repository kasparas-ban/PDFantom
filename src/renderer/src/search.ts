export type SearchState = {
  readonly query: string
  readonly phase: "idle" | "searching" | "found" | "not-found"
  readonly current: number
  readonly total: number
  readonly wrapped: boolean
}

export type SearchSnapshot = SearchState & {
  readonly visible: boolean
}

export const EMPTY_SEARCH_SNAPSHOT: SearchSnapshot = {
  visible: false,
  query: "",
  phase: "idle",
  current: 0,
  total: 0,
  wrapped: false,
}
