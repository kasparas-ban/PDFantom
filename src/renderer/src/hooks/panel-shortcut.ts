export type PanelShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "defaultPrevented" | "metaKey" | "shiftKey"
>

export function getPanelShortcut(event: PanelShortcutEvent) {
  if (
    event.defaultPrevented ||
    !event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.code !== "KeyB"
  ) {
    return null
  }

  return event.altKey ? "chat" : "documents"
}
