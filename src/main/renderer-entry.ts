import path from "node:path"
import { pathToFileURL } from "node:url"

export function rendererEntryUrl() {
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return MAIN_WINDOW_VITE_DEV_SERVER_URL
  }

  const rendererName =
    typeof MAIN_WINDOW_VITE_NAME === "undefined" ? "main_window" : MAIN_WINDOW_VITE_NAME
  return pathToFileURL(path.join(__dirname, `../renderer/${rendererName}/index.html`)).href
}
