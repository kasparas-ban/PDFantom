export const MINIMUM_PANEL_WIDTH = 200
export const MAXIMUM_PANEL_WIDTH = 1400
export const MINIMUM_READER_WIDTH = 320

export const READER_PANEL_IDS = ["documents", "chat", "side-chat"] as const

export type ReaderPanelId = (typeof READER_PANEL_IDS)[number]

type ReaderPanelInput = {
  readonly isOpen: boolean
  readonly preferredWidth: number
}

type ReaderWorkspaceLayoutInput = {
  readonly panels: Readonly<Record<ReaderPanelId, ReaderPanelInput>>
  readonly lastResizedPanel: ReaderPanelId | null
  readonly viewportWidth: number
}

export function resolveReaderWorkspaceLayout({
  panels,
  lastResizedPanel,
  viewportWidth,
}: ReaderWorkspaceLayoutInput) {
  const open = READER_PANEL_IDS.filter((id) => panels[id].isOpen)
  const panelBudget = Math.max(
    open.length * MINIMUM_PANEL_WIDTH,
    viewportWidth - MINIMUM_READER_WIDTH,
  )
  const maximumWidth = Math.max(
    MINIMUM_PANEL_WIDTH,
    Math.min(MAXIMUM_PANEL_WIDTH, panelBudget - Math.max(0, open.length - 1) * MINIMUM_PANEL_WIDTH),
  )
  const widths = panelRecord((id) => clampPanelWidth(panels[id].preferredWidth, maximumWidth))
  const kept =
    lastResizedPanel !== null && open.includes(lastResizedPanel) ? lastResizedPanel : null
  const flexible = open.filter((id) => id !== kept)
  const fitted = fitWidths(
    flexible.map((id) => widths[id]),
    panelBudget - (kept ? widths[kept] : 0),
  )
  flexible.forEach((id, index) => {
    widths[id] = fitted[index]
  })

  return panelRecord((id) => ({ maximumWidth, width: widths[id] }))
}

function panelRecord<T>(build: (id: ReaderPanelId) => T): Record<ReaderPanelId, T> {
  return { documents: build("documents"), chat: build("chat"), "side-chat": build("side-chat") }
}

function fitWidths(widths: readonly number[], budget: number) {
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (total <= budget) return [...widths]

  const flex = widths.map((width) => width - MINIMUM_PANEL_WIDTH)
  const flexTotal = flex.reduce((sum, value) => sum + value, 0)
  const flexBudget = budget - widths.length * MINIMUM_PANEL_WIDTH
  const fitted = flex.map(
    (value) => MINIMUM_PANEL_WIDTH + Math.round((flexBudget * value) / flexTotal),
  )
  fitted[fitted.length - 1] += budget - fitted.reduce((sum, width) => sum + width, 0)

  return fitted
}

function clampPanelWidth(width: number, maximumWidth: number) {
  return Math.min(maximumWidth, Math.max(MINIMUM_PANEL_WIDTH, width))
}
