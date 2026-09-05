import { documentVersionKey } from "../../../shared/document-api"
import { createPDFReaderRuntime } from "./pdf-reader-runtime"
import { capturePreview, decodePreview, viewportAppearance } from "./reader-preview"
import type { ReaderSurfaces } from "./reader-workspace"
import type { ReaderSessionStore } from "../store/reader-session-store"

export function createReaderSurfaces(host: HTMLElement, store: ReaderSessionStore): ReaderSurfaces {
  return {
    appearance: () => viewportAppearance(host),
    create: (document, worker, onStatusChange, onSettled) => {
      const key = documentVersionKey(document)
      const section = window.document.createElement("section")
      section.className = "absolute inset-0 overflow-hidden bg-[#e7e7e5] dark:bg-[#171716]"
      section.dataset.readerVersion = key
      section.style.visibility = "hidden"
      section.inert = true
      section.setAttribute("aria-hidden", "true")

      const container = window.document.createElement("div")
      container.className = "absolute inset-0 overflow-auto outline-none"

      const viewer = window.document.createElement("div")
      viewer.className = "pdfViewer pdf-reader-viewer pt-1"

      container.append(viewer)
      section.append(container)
      host.append(section)

      let dimensions = viewportAppearance(host)
      const initial = store.getState().views[key]
      const runtime = createPDFReaderRuntime({
        document,
        worker,
        container,
        viewer,
        initialLifecycle: "inactive",
        initialReadingPosition: initial.initialReadingPosition,
        onPageChange: (currentPage) => store.getState().reportView(document, { currentPage }),
        onPageCountChange: (pageCount) =>
          store.getState().reportView(document, {
            pageCount,
            currentPage: Math.min(initial.currentPage, pageCount),
          }),
        onScaleChange: (zoom) => store.getState().reportView(document, { zoom }),
        onPinchZoom: (zoom) => store.getState().reportView(document, { zoom, scalePreset: null }),
        onReadingPositionChange: (position) =>
          store.getState().reportReadingPosition(document, position),
        onStatusChange,
        onSettled,
      })

      runtime.setScale(initial.scalePreset ?? initial.zoom)
      runtime.setPageLayout(initial.pageLayout)
      runtime.setPageView(initial.pageView)
      runtime.goToPage(initial.currentPage)

      const unsubscribe = store.subscribe((state, previous) => {
        const next = state.views[key]
        const old = previous.views[key]
        if (!next || !old) return

        if (next.scalePreset !== old.scalePreset || (!next.scalePreset && next.zoom !== old.zoom)) {
          runtime.setScale(next.scalePreset ?? next.zoom)
        }

        if (next.pageLayout !== old.pageLayout) runtime.setPageLayout(next.pageLayout)
        if (next.pageView !== old.pageView) runtime.setPageView(next.pageView)
        if (next.currentPage !== old.currentPage) runtime.goToPage(next.currentPage)
      })

      return {
        runtime,
        compatible: () => {
          const current = viewportAppearance(host)

          return current.width === dimensions.width && current.height === dimensions.height
        },
        prepare: () => {
          const current = viewportAppearance(host)
          const changed = current.width !== dimensions.width || current.height !== dimensions.height

          if (!current.width || !current.height) return
          section.style.width = section.style.height = ""
          runtime.setLifecycle("preparing")

          if (changed) runtime.reconcileLayout()
        },
        show: () => {
          dimensions = viewportAppearance(host)

          section.style.width = section.style.height = ""
          section.style.visibility = "visible"
          section.dataset.presented = "true"
          section.inert = false
          section.removeAttribute("aria-hidden")
          container.setAttribute("aria-label", "PDF reader")
          runtime.setLifecycle("presented")
        },
        hide: () => {
          runtime.setLifecycle("inactive")
          const current = viewportAppearance(section)
          if (current.width > 0 && current.height > 0) dimensions = current

          section.style.width = `${dimensions.width}px`
          section.style.height = `${dimensions.height}px`
          section.style.visibility = "hidden"
          section.dataset.presented = "false"
          section.inert = true
          section.setAttribute("aria-hidden", "true")
          container.removeAttribute("aria-label")
        },
        capture: () =>
          runtime.isReady()
            ? capturePreview(container, viewportAppearance(section))
            : Promise.resolve(null),
        dispose: async () => {
          unsubscribe()

          const destruction = runtime.destroy()
          section.remove()

          await destruction
        },
      }
    },
    preview: async (record) => {
      const decoded = await decodePreview(record)
      if (!decoded) return null

      decoded.image.className = "absolute inset-0 h-full w-full pointer-events-none select-none"
      decoded.image.alt =
        "Saved reading viewport. Text selection and navigation will be available when the reader is ready."
      decoded.image.dataset.readerPreview = "true"

      return {
        show: () => host.append(decoded.image),
        dispose: () => {
          decoded.image.remove()
          decoded.dispose()
        },
      }
    },
  }
}
