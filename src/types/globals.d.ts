import type { TextbookApi } from "../shared/textbook-api"

declare global {
  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
  const MAIN_WINDOW_VITE_NAME: string

  interface Window {
    pdfantom: TextbookApi
  }
}

export {}
