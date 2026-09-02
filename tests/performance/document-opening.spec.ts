import { copyFile, mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

import { launchTestApplication } from "../app/launch-application"

// Dedicated visible-window measurement, excluded from the normal E2E suite.
test("measure document opening and retained switching", async () => {
  const application = await launchTestApplication({
    workspacePrefix: "pdfantom-performance",
    windowMode: "visible",
  })
  const samples: { visual: number; interactive: number }[] = []
  try {
    const { page } = application
    await page.getByRole("button", { name: "Choose a PDF" }).waitFor()
    const launchToShell = performance.now() - application.launchStartedAt
    await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
    const first = await measure(page, "Choose a PDF", "document-mock.pdf")
    await mkdir(test.info().outputDir, { recursive: true })
    const secondPath = test.info().outputPath("selectable-copy.pdf")
    await copyFile(path.resolve("tests/fixtures/pdfs/document-mock.pdf"), secondPath)
    await application.selectOpenPath(secondPath)
    const second = await measure(page, "Open PDF", "selectable-copy.pdf")
    for (let index = 0; index < 36; index++) {
      const name = index % 2 ? "selectable-copy.pdf" : "document-mock.pdf"
      // eslint-disable-next-line no-await-in-loop -- Sequential user switches are the measured workload.
      const sample = await measure(page, name, name)
      if (index >= 6) samples.push(sample)
    }
    await page.screenshot({ path: test.info().outputPath("warm-reader.png") })
    await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/mixed-page-sizes.pdf"))
    const mixed = await measure(page, "Open PDF", "mixed-page-sizes.pdf")
    if (process.env.PDFANTOM_PERFORMANCE !== "baseline") {
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { selectedDocument } = await window.pdfantom.getDocumentLibrary()
            return new Promise<number>((resolve) => {
              const open = indexedDB.open("pdfantom-reader-previews", 1)
              open.onsuccess = () => {
                const db = open.result
                if (!db.objectStoreNames.contains("viewports")) {
                  db.close()
                  resolve(0)
                  return
                }
                const request = db.transaction("viewports").objectStore("viewports").getAll()
                request.onsuccess = () => {
                  resolve(
                    request.result.filter((record) => record.documentId === selectedDocument?.id)
                      .length,
                  )
                  db.close()
                }
              }
            })
          }),
        )
        .toBeGreaterThan(0)
    }
    const memory = await application.electronApplication.evaluate(({ app }) =>
      app.getAppMetrics().map(({ type, memory: usage }) => ({ type, memory: usage })),
    )
    const restarted = await application.relaunch()
    const restoredTiming = await correctViewport(restarted.page, "mixed-page-sizes.pdf")
    const restartToLive = performance.now() - restarted.launchStartedAt
    const restartToPixels = restartToLive - (restoredTiming.interactive - restoredTiming.visual)
    const restartMarks = await restarted.page.evaluate(() => ({
      metadata: performance.getEntriesByName("reader-metadata-ready").at(-1)?.startTime,
      preview: performance.getEntriesByName("reader-preview-presented").at(-1)?.startTime,
      live: performance.getEntriesByName("reader-live-presented").at(-1)?.startTime,
    }))
    await restarted.page.screenshot({ path: test.info().outputPath("restarted-reader.png") })
    const summarize = (field: "visual" | "interactive") => {
      const sorted = samples.map((sample) => sample[field]).toSorted((a, b) => a - b)
      return {
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      }
    }
    console.log(
      JSON.stringify({
        build: process.env.PDFANTOM_PERFORMANCE ?? "production",
        launchToShell,
        first,
        second,
        mixed,
        samples: samples.length,
        visual: summarize("visual"),
        interactive: summarize("interactive"),
        restartToPixels,
        restartToLive,
        restartMarks,
        memory,
      }),
    )
    expect(samples).toHaveLength(30)
  } finally {
    await application.close()
  }
})

async function measure(page: Page, button: string, title: string) {
  const start = await page
    .getByRole("button", { name: button, exact: true })
    .evaluate((element) => {
      const timestamp = performance.now()
      if (element instanceof HTMLButtonElement) element.click()
      return timestamp
    })
  const result = await correctViewport(page, title)
  return { visual: result.visual - start, interactive: result.interactive - start }
}

test("measure bounded retention after repeated eviction cycles", async () => {
  test.skip(process.env.PDFANTOM_PERFORMANCE === "baseline")
  const application = await launchTestApplication({
    workspacePrefix: "pdfantom-retention-performance",
    windowMode: "visible",
  })
  try {
    await mkdir(test.info().outputDir, { recursive: true })
    const paths = Array.from({ length: 5 }, (_, index) =>
      test.info().outputPath(`cycle-${index}.pdf`),
    )
    await Promise.all(
      paths.map((target) =>
        copyFile(path.resolve("tests/fixtures/pdfs/document-mock.pdf"), target),
      ),
    )
    const measurements = []
    for (let index = 0; index < 20; index++) {
      // eslint-disable-next-line no-await-in-loop -- Serial eviction/reopening cycles are the workload.
      await application.selectOpenPath(paths[index % paths.length])
      // eslint-disable-next-line no-await-in-loop -- Measure each completed opening before starting the next.
      await measure(
        application.page,
        index === 0 ? "Choose a PDF" : "Open PDF",
        `cycle-${index % paths.length}.pdf`,
      )
      if ((index + 1) % 5 === 0) {
        // eslint-disable-next-line no-await-in-loop -- Record memory at each completed cycle.
        const memory = await application.electronApplication.evaluate(({ app }) =>
          app.getAppMetrics().map(({ type, memory: usage }) => ({ type, memory: usage })),
        )
        // eslint-disable-next-line no-await-in-loop -- Verify the bound at each completed cycle.
        const readers = await application.page.locator("[data-reader-version]").count()
        const workers = application.page.workers().length
        measurements.push({ opens: index + 1, readers, workers, memory })
        expect(readers).toBe(3)
        expect(workers).toBe(1)
      }
    }
    console.log(JSON.stringify({ retention: measurements }))
  } finally {
    await application.close()
  }
})

async function correctViewport(page: Page, title: string) {
  return page.evaluate(async (name) => {
    let visual = 0
    return new Promise<{ visual: number; interactive: number }>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              JSON.stringify({
                title: [...document.querySelectorAll("h2")].map((element) => element.textContent),
                readers: document.querySelectorAll('[aria-label="PDF reader"]').length,
                html: document.querySelector('[aria-label="PDF reader"]')?.innerHTML.slice(0, 500),
              }),
            ),
          ),
        10000,
      )
      const frame = () => {
        const heading = [...document.querySelectorAll("h2")].find(
          (node) => node.textContent === name,
        )
        const preview = document.querySelector<HTMLImageElement>('[data-reader-preview="true"]')
        if (heading && preview?.complete && preview.naturalWidth) {
          const rect = preview.getBoundingClientRect()
          const exposed = document.elementFromPoint(rect.left + 20, rect.top + 20)
          if ((exposed === preview || exposed === preview.parentElement) && !visual) {
            visual = performance.now()
          }
        }
        const reader =
          document.querySelector('[data-presented="true"] [aria-label="PDF reader"]') ??
          document.querySelector('[aria-label="PDF reader"]')
        const canvas = reader?.querySelector("canvas")
        const bounds = canvas?.getBoundingClientRect()
        const top =
          bounds &&
          document.elementFromPoint(bounds.left + bounds.width / 2, Math.max(60, bounds.top + 30))
        const exposed =
          heading && canvas && bounds && reader?.contains(top ?? null) && canvas.width > 0
        if (exposed) {
          const pixels = canvas
            .getContext("2d")
            ?.getImageData(0, 0, canvas.width, canvas.height).data
          // Confirm actual raster data; don't mistake an allocated blank canvas for a drawn page.
          const painted = pixels?.some((value, index) => index % 4 === 3 && value !== 0)
          if (painted && !visual) visual = performance.now()
          if (
            visual &&
            (name === "mixed-page-sizes.pdf" || reader?.querySelector(".textLayer span")) &&
            !document.querySelector("fieldset[disabled]")
          ) {
            clearTimeout(timeout)
            requestAnimationFrame(() => resolve({ visual, interactive: performance.now() }))
            return
          }
        }
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
  }, title)
}
