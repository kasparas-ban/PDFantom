export const MINIMUM_PANEL_WIDTH = 200
export const MAXIMUM_PANEL_WIDTH = 1400
export const MINIMUM_READER_WIDTH = 320

type ReaderWorkspaceLayoutInput = {
  readonly isChatPanelOpen: boolean
  readonly isDocumentsPanelOpen: boolean
  readonly lastResizedPanel: "chat" | "documents" | null
  readonly preferredChatPanelWidth: number
  readonly preferredDocumentsPanelWidth: number
  readonly viewportWidth: number
}

export function resolveReaderWorkspaceLayout({
  isChatPanelOpen,
  isDocumentsPanelOpen,
  lastResizedPanel,
  preferredChatPanelWidth,
  preferredDocumentsPanelWidth,
  viewportWidth,
}: ReaderWorkspaceLayoutInput) {
  const openPanelCount = Number(isChatPanelOpen) + Number(isDocumentsPanelOpen)
  const panelBudget = Math.max(
    openPanelCount * MINIMUM_PANEL_WIDTH,
    viewportWidth - MINIMUM_READER_WIDTH,
  )
  const maximumWidth = Math.max(
    MINIMUM_PANEL_WIDTH,
    Math.min(
      MAXIMUM_PANEL_WIDTH,
      panelBudget - Math.max(0, openPanelCount - 1) * MINIMUM_PANEL_WIDTH,
    ),
  )
  const chatPanelWidth = clampPanelWidth(preferredChatPanelWidth, maximumWidth)
  const documentsPanelWidth = clampPanelWidth(preferredDocumentsPanelWidth, maximumWidth)

  if (!isChatPanelOpen || !isDocumentsPanelOpen) {
    return {
      chatPanel: { maximumWidth, width: chatPanelWidth },
      documentsPanel: { maximumWidth, width: documentsPanelWidth },
    }
  }

  const preferredTotalWidth = chatPanelWidth + documentsPanelWidth
  if (preferredTotalWidth <= panelBudget) {
    return {
      chatPanel: { maximumWidth, width: chatPanelWidth },
      documentsPanel: { maximumWidth, width: documentsPanelWidth },
    }
  }

  if (lastResizedPanel === "chat") {
    return {
      chatPanel: { maximumWidth, width: chatPanelWidth },
      documentsPanel: {
        maximumWidth,
        width: panelBudget - chatPanelWidth,
      },
    }
  }

  if (lastResizedPanel === "documents") {
    return {
      chatPanel: {
        maximumWidth,
        width: panelBudget - documentsPanelWidth,
      },
      documentsPanel: { maximumWidth, width: documentsPanelWidth },
    }
  }

  const flexibleBudget = panelBudget - 2 * MINIMUM_PANEL_WIDTH
  const preferredChatFlex = chatPanelWidth - MINIMUM_PANEL_WIDTH
  const preferredDocumentsFlex = documentsPanelWidth - MINIMUM_PANEL_WIDTH
  const preferredFlex = preferredChatFlex + preferredDocumentsFlex
  const effectiveDocumentsFlex = Math.round(
    flexibleBudget * (preferredDocumentsFlex / preferredFlex),
  )
  const effectiveDocumentsPanelWidth = MINIMUM_PANEL_WIDTH + effectiveDocumentsFlex

  return {
    chatPanel: {
      maximumWidth,
      width: panelBudget - effectiveDocumentsPanelWidth,
    },
    documentsPanel: {
      maximumWidth,
      width: effectiveDocumentsPanelWidth,
    },
  }
}

function clampPanelWidth(width: number, maximumWidth: number) {
  return Math.min(maximumWidth, Math.max(MINIMUM_PANEL_WIDTH, width))
}
