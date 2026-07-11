import { RENDERER_API_GLOBAL, type RendererApi } from "../shared/renderer-api"

declare global {
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
  const MAIN_WINDOW_VITE_NAME: string

  interface Window {
    [RENDERER_API_GLOBAL]: RendererApi
  }
}

export {}
