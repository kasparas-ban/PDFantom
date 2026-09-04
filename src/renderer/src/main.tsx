import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createHashRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import { PlatformContext } from "./platform"
import { routes } from "./routes"

import "pdfjs-dist/web/pdf_viewer.css"
import "./styles.css"

const router = createHashRouter(routes)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlatformContext value={window.pdfantom}>
      <RouterProvider router={router} />
    </PlatformContext>
  </StrictMode>,
)
