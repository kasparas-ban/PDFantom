export const GET_FULL_SCREEN_CHANNEL = "window:get-full-screen"
export const FULL_SCREEN_CHANGED_CHANNEL = "window:full-screen-changed"

export type WindowApi = {
  getIsFullScreen(): Promise<boolean>
  onFullScreenChange(listener: (isFullScreen: boolean) => void): () => void
}
