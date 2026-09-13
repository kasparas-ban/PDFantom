import { RENDERER_API_GLOBAL, type RendererApi } from "../shared/renderer-api"

declare global {
  class Highlight extends Set<AbstractRange> {
    constructor(...ranges: AbstractRange[])
  }

  namespace CSS {
    const highlights: Map<string, Highlight>
  }

  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
  const MAIN_WINDOW_VITE_NAME: string

  interface Window {
    [RENDERER_API_GLOBAL]: RendererApi
  }
}

export {}
