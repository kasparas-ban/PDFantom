import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { build } from "vite"

import { expect, test } from "./test"

const moduleUrl = pathToFileURL(path.resolve(".vite/reader-tests/reader-boundary.mjs")).href
type Boundary = typeof import("../renderer/reader-boundary")

test.beforeAll(async () => {
  await build({ configFile: path.resolve("tests/renderer/vite.config.ts") })
})

test("initial viewport renders while unrelated PDF.js page initialization is held pending", async ({
  application,
}) => {
  const bytes = [...(await readFile("tests/fixtures/pdfs/document-mock.pdf"))]
  const result = await application.page.evaluate(
    async ({ moduleUrl: url, bytes: data }) => {
      const boundary: Boundary = await import(url)
      const { createPDFReaderRuntime, createReaderWorker, PDFViewer } = boundary
      const host = document.createElement("div")
      host.style.cssText = "position:fixed;inset:48px 0 0 256px;background:#e7e7e5;z-index:50"
      const container = document.createElement("div")
      container.style.cssText = "position:absolute;inset:0;overflow:auto"
      const viewer = document.createElement("div")
      viewer.className = "pdfViewer"
      container.append(viewer)
      host.append(container)
      document.body.append(host)
      const gate = Promise.withResolvers<void>()
      let allPages = false
      // eslint-disable-next-line typescript/unbound-method -- Deliberately replacing/restoring a method at the PDF.js test boundary.
      const setDocument = PDFViewer.prototype.setDocument
      PDFViewer.prototype.setDocument = function (pdf) {
        if (pdf) {
          const getPage = pdf.getPage.bind(pdf)
          pdf.getPage = async (page) => {
            if (page === 5) {
              await gate.promise
              allPages = true
            }
            return getPage(page)
          }
        }
        setDocument.call(this, pdf)
      }
      const ready = Promise.withResolvers<boolean>()
      const worker = createReaderWorker()
      const runtime = createPDFReaderRuntime({
        worker,
        document: {
          id: "test",
          name: "test.pdf",
          fingerprint: "a".repeat(64),
          bytes: new Uint8Array(data).buffer,
        },
        container,
        viewer,
        initialReadingPosition: null,
        onPageChange: () => {},
        onPageCountChange: () => {},
        onScaleChange: () => {},
        onPinchZoom: () => {},
        onReadingPositionChange: () => {},
        onSettled: () => {},
        onStatusChange: (status) => {
          if (status.state === "ready" && status.interactive) ready.resolve(allPages)
        },
      })
      const unrelatedFinishedAtReadiness = await ready.promise
      const canvas = viewer.querySelector("canvas")!
      const raster = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data
      const hasInk = raster.some((channel, index) => index % 4 === 0 && channel < 200)
      const text = viewer.querySelector(".textLayer")?.textContent ?? ""
      gate.resolve()
      await runtime.destroy()
      worker.destroy()
      host.remove()
      PDFViewer.prototype.setDocument = setDocument
      return { unrelatedFinishedAtReadiness, hasInk, text: Boolean(text) }
    },
    { moduleUrl, bytes },
  )
  expect(result).toEqual({ unrelatedFinishedAtReadiness: false, hasInk: true, text: true })
})

test("PDF.js initialization milestones resume after finishing while inactive", async ({
  application,
}) => {
  const bytes = [...(await readFile("tests/fixtures/pdfs/document-mock.pdf"))]
  const result = await application.page.evaluate(
    async ({ moduleUrl: url, bytes: data }) => {
      const boundary: Boundary = await import(url)
      const { createPDFReaderRuntime, createReaderWorker, PDFViewer } = boundary
      const host = document.createElement("div")
      host.style.cssText = "position:fixed;inset:48px 0 0 256px;background:#e7e7e5;z-index:50"
      const container = document.createElement("div")
      container.style.cssText = "position:absolute;inset:0;overflow:auto"
      const viewer = document.createElement("div")
      viewer.className = "pdfViewer"
      container.append(viewer)
      host.append(container)
      document.body.append(host)
      const firstPageGate = Promise.withResolvers<void>()
      const firstPageRequested = Promise.withResolvers<void>()
      const lastPageGate = Promise.withResolvers<void>()
      const lastPageRequested = Promise.withResolvers<void>()
      const pagesLoaded = Promise.withResolvers<void>()
      const pagesInitialized = Promise.withResolvers<void>()
      const observer = new MutationObserver(() => {
        if (viewer.querySelectorAll(".page").length !== 5) return

        observer.disconnect()
        pagesInitialized.resolve()
      })
      observer.observe(viewer, { childList: true, subtree: true })
      // eslint-disable-next-line typescript/unbound-method -- Deliberately replacing/restoring a method at the PDF.js test boundary.
      const setDocument = PDFViewer.prototype.setDocument
      PDFViewer.prototype.setDocument = function (pdf) {
        if (pdf) {
          const getPage = pdf.getPage.bind(pdf)
          pdf.getPage = async (page) => {
            if (page === 1) {
              firstPageRequested.resolve()
              await firstPageGate.promise
            }
            if (page === 5) {
              lastPageRequested.resolve()
              await lastPageGate.promise
            }

            return getPage(page)
          }
        }

        setDocument.call(this, pdf)
        if (pdf) void this.pagesPromise?.then(() => pagesLoaded.resolve())
      }
      const ready = Promise.withResolvers<{ interactive: boolean }>()
      const worker = createReaderWorker()
      let reportedPage = 0
      let readyWhileInactive = false
      let inactive = false
      const runtime = createPDFReaderRuntime({
        worker,
        document: {
          id: "late-events",
          name: "late-events.pdf",
          fingerprint: "b".repeat(64),
          bytes: new Uint8Array(data).buffer,
        },
        container,
        viewer,
        initialReadingPosition: {
          pageNumber: 3,
          offsetX: 0,
          offsetY: 40,
          zoom: 1.25,
          scalePreset: null,
          pageView: "single",
          pageLayout: "vertical",
        },
        onPageChange: (page) => {
          reportedPage = page
        },
        onPageCountChange: () => {},
        onScaleChange: () => {},
        onPinchZoom: () => {},
        onReadingPositionChange: () => {},
        onSettled: () => {},
        onStatusChange: (status) => {
          if (status.state !== "ready") return
          if (inactive) readyWhileInactive = true
          ready.resolve(status)
        },
      })
      runtime.setScale(1.25)
      runtime.goToPage(3)

      await firstPageRequested.promise
      inactive = true
      runtime.setLifecycle("inactive")
      firstPageGate.resolve()
      await pagesInitialized.promise
      const copyBeforeResume = container.querySelector("#hiddenCopyElement") !== null

      inactive = false
      runtime.setLifecycle("preparing")
      const copyAfterResume = container.querySelector("#reader-copy-late-events") !== null
      await lastPageRequested.promise

      inactive = true
      runtime.setLifecycle("inactive")
      lastPageGate.resolve()
      await pagesLoaded.promise

      inactive = false
      runtime.setLifecycle("preparing")
      const status = await ready.promise
      const hasCanvas = viewer.querySelector("canvas") !== null

      await runtime.destroy()
      worker.destroy()
      host.remove()
      PDFViewer.prototype.setDocument = setDocument

      return {
        copyBeforeResume,
        copyAfterResume,
        readyWhileInactive,
        reportedPage,
        interactive: status.interactive,
        hasCanvas,
      }
    },
    { moduleUrl, bytes },
  )

  expect(result).toEqual({
    copyBeforeResume: true,
    copyAfterResume: true,
    readyWhileInactive: false,
    reportedPage: 3,
    interactive: true,
    hasCanvas: true,
  })
})

test("native preview storage handles revisions, invalidation, corruption, recreation and both limits", async ({
  application,
}) => {
  const result = await application.page.evaluate(async (url) => {
    const boundary: Boundary = await import(url)
    const { ReaderPreviewCache, compatiblePreview, safeViewport } = boundary
    const cache = new ReaderPreviewCache()
    const document = { id: "test", name: "test.pdf", fingerprint: "a".repeat(64) }
    const position = {
      pageNumber: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      scalePreset: null,
      pageView: "single",
      pageLayout: "vertical",
    } as const
    const appearance = { width: 100, height: 100, density: 1, background: "white" }
    const make = (id: string, size: number, revision: number) => ({
      ...appearance,
      key: `${id}:${document.fingerprint}`,
      documentId: id,
      fingerprint: document.fingerprint,
      position,
      pageCount: 1,
      generation: "test",
      revision,
      lastUsed: revision,
      bytes: size,
      blob: new Blob([new Uint8Array(size)], { type: "image/png" }),
    })
    const newer = make("test", 20, 2)
    await cache.write(newer, () => true)
    await cache.write(make("test", 10, 1), () => true)
    const revision = (await cache.read(document, position, appearance))?.revision
    const incompatible = await cache.read(document, { ...position, offsetY: 1 }, appearance)
    const incompatibleAppearance = [
      { ...appearance, width: 101 },
      { ...appearance, density: 2 },
      { ...appearance, background: "black" },
    ].some((value) => compatiblePreview(newer, document, position, value))
    let checks = 0
    await cache.write(make("expired", 10, 1), () => ++checks < 4)
    const expired = await cache.read({ ...document, id: "expired" }, position, appearance)
    const ticket = cache.ticket(document)
    await cache.invalidate(document)
    await cache.write(newer, ticket.valid)
    const invalidated = await cache.read(document, position, appearance)
    const reopened = new ReaderPreviewCache()
    await reopened.write({ ...make("test", 10, 1), generation: "new-session" }, () => true)
    const recreated = await reopened.read(document, position, appearance)
    for (let index = 0; index < 25; index++) {
      // eslint-disable-next-line no-await-in-loop -- Count-bound pruning must happen even for tiny previews.
      await reopened.write(make(`small-${index}`, 10, index + 10), () => true)
    }
    const countDatabase = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("pdfantom-reader-previews", 1)
      open.onsuccess = () => resolve(open.result)
    })
    const countBound = await new Promise<number>((resolve) => {
      const request = countDatabase.transaction("viewports").objectStore("viewports").count()
      request.onsuccess = () => resolve(request.result)
    })
    countDatabase.close()
    for (let index = 0; index < 25; index++) {
      // eslint-disable-next-line no-await-in-loop -- Exercise ordered transactions and pruning after each write.
      await reopened.write(make(`entry-${index}`, 2 * 1024 * 1024, index + 10), () => true)
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("pdfantom-reader-previews", 1)
      request.addEventListener("success", () => resolve(request.result))
      request.addEventListener("error", () => reject(request.error))
    })
    const rows = await new Promise<{ bytes: number }[]>((resolve) => {
      const request = database.transaction("viewports").objectStore("viewports").getAll()
      request.onsuccess = () => resolve(request.result)
    })
    const bad = compatiblePreview(
      { ...newer, blob: new Blob(["corrupt"]) },
      document,
      position,
      appearance,
    )
    const unsafe =
      safeViewport({ ...appearance, width: Infinity }) ||
      safeViewport({ ...appearance, width: 100000 })
    database.close()
    cache.dispose()
    reopened.dispose()
    return {
      revision,
      incompatible,
      incompatibleAppearance,
      expired,
      invalidated,
      recreated: recreated?.generation,
      countBound,
      count: rows.length,
      bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
      bad,
      unsafe,
    }
  }, moduleUrl)
  expect(result).toMatchObject({
    revision: 2,
    incompatible: null,
    incompatibleAppearance: false,
    expired: null,
    invalidated: null,
    recreated: "new-session",
    bad: false,
    unsafe: false,
  })
  expect(result.count).toBeLessThanOrEqual(20)
  expect(result.countBound).toBe(20)
  expect(result.bytes).toBeLessThanOrEqual(32 * 1024 * 1024)
})

test("a preview is persisted, shown before delayed verification, and replaced by the same live viewport", async ({
  application,
}) => {
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
  await application.page.getByRole("button", { name: "Choose a PDF" }).click()
  await expect(application.page.getByRole("spinbutton", { name: "Page number" })).toBeEnabled()
  await application.page.getByRole("spinbutton", { name: "Page number" }).fill("3")
  await application.page.getByRole("spinbutton", { name: "Page number" }).press("Enter")
  await expect
    .poll(() =>
      application.page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          const open = indexedDB.open("pdfantom-reader-previews", 1)
          open.onsuccess = () => {
            const db = open.result
            const read = db.transaction("viewports").objectStore("viewports").getAll()
            read.onsuccess = () => {
              const count = read.result.filter((row) => row.position.pageNumber === 3).length
              db.close()
              resolve(count)
            }
          }
        })
      }),
    )
    .toBe(1)
  const savedPixels = await application.page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("pdfantom-reader-previews", 1)
      open.onsuccess = () => resolve(open.result)
    })
    const blob = await new Promise<Blob>((resolve) => {
      const read = db.transaction("viewports").objectStore("viewports").getAll()
      read.onsuccess = () => resolve(read.result.find((row) => row.position.pageNumber === 3).blob)
    })
    db.close()
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  // Delay the trusted main boundary itself across reload; no production test API.
  await application.electronApplication.evaluate(({ ipcMain }) => {
    const handlers: Map<string, (...args: unknown[]) => unknown> = Reflect.get(
      ipcMain,
      "_invokeHandlers",
    )
    const original = handlers.get("document:load")!
    const gate = Promise.withResolvers<void>()
    Reflect.set(globalThis, "releaseDocumentCheck", gate.resolve)
    ipcMain.removeHandler("document:load")
    ipcMain.handle("document:load", async (...args) => {
      await gate.promise
      return original(...args)
    })
  })
  await application.page.reload()
  await expect(application.page.locator('[data-reader-preview="true"]')).toBeVisible()
  await expect(application.page.getByRole("spinbutton", { name: "Page number" })).toHaveValue("3")
  await expect(application.page.getByRole("spinbutton", { name: "Page number" })).toBeDisabled()
  await application.page.screenshot({ path: test.info().outputPath("saved-preview.png") })
  await application.electronApplication.evaluate(() => {
    const release: () => void = Reflect.get(globalThis, "releaseDocumentCheck")
    release()
    Reflect.deleteProperty(globalThis, "releaseDocumentCheck")
  })
  await expect(application.page.getByRole("spinbutton", { name: "Page number" })).toBeEnabled()
  await expect(application.page.locator('[data-reader-preview="true"]')).toHaveCount(0)
  await expect(application.page.getByRole("spinbutton", { name: "Page number" })).toHaveValue("3")
  await application.page.screenshot({ path: test.info().outputPath("live-handoff.png") })
  const difference = await application.page.evaluate(
    async ({ url, saved }) => {
      const boundary: Boundary = await import(url)
      const reader = document.querySelector<HTMLElement>('[aria-label="PDF reader"]')!
      const section = reader.parentElement!
      const captured = await boundary.capturePreview(reader, {
        width: section.clientWidth,
        height: section.clientHeight,
        density: Math.min(devicePixelRatio, 2),
        background: getComputedStyle(section).backgroundColor,
      })
      const oldImage = await createImageBitmap(
        new Blob([new Uint8Array(saved)], { type: "image/png" }),
      )
      const newImage = await createImageBitmap(captured!)
      const canvas = document.createElement("canvas")
      canvas.width = oldImage.width
      canvas.height = oldImage.height
      const context = canvas.getContext("2d")!
      context.drawImage(oldImage, 0, 0)
      const before = context.getImageData(0, 0, canvas.width, canvas.height).data
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(newImage, 0, 0)
      const after = context.getImageData(0, 0, canvas.width, canvas.height).data
      let changed = 0
      for (let index = 0; index < before.length; index++)
        if (before[index] !== after[index]) changed++
      oldImage.close()
      newImage.close()
      return changed / before.length
    },
    { url: moduleUrl, saved: savedPixels },
  )
  expect(difference).toBe(0)
})

test("quota, unavailable storage, malformed records and corrupt PNGs remain cache misses", async ({
  application,
}) => {
  const result = await application.page.evaluate(async (url) => {
    const boundary: Boundary = await import(url)
    const cache = new boundary.ReaderPreviewCache()
    const documentVersion = { id: "fault-test", name: "test.pdf", fingerprint: "a".repeat(64) }
    const position = {
      pageNumber: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      scalePreset: null,
      pageView: "single",
      pageLayout: "vertical",
    } as const
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 10
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/png"),
    )
    const record = {
      key: `fault-test:${documentVersion.fingerprint}`,
      documentId: documentVersion.id,
      fingerprint: documentVersion.fingerprint,
      blob,
      bytes: blob.size,
      position,
      pageCount: 1,
      width: 10,
      height: 10,
      density: 1,
      background: "white",
      generation: "test",
      revision: 1,
      lastUsed: 1,
    }
    await cache.write(record, () => true)
    // eslint-disable-next-line typescript/unbound-method -- Fault injection at the native storage boundary, restored below.
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError")
    }
    await cache.write({ ...record, revision: 2 }, () => true)
    IDBObjectStore.prototype.put = put
    const preserved = await cache.read(documentVersion, position, record)
    const corrupt = await boundary.decodePreview({
      ...record,
      blob: new Blob(["broken"], { type: "image/png" }),
    })
    const db = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open("pdfantom-reader-previews", 1)
      open.onsuccess = () => resolve(open.result)
    })
    await new Promise<void>((resolve) => {
      const transaction = db.transaction("viewports", "readwrite")
      transaction.objectStore("viewports").put({ ...record, bytes: "invalid" })
      transaction.oncomplete = () => resolve()
    })
    const malformed = await cache.read(documentVersion, position, record)
    db.close()
    cache.dispose()
    const open = indexedDB.open.bind(indexedDB)
    indexedDB.open = () => {
      throw new Error("Storage unavailable")
    }
    const unavailable = new boundary.ReaderPreviewCache()
    const missed = await unavailable.read(documentVersion, position, record)
    unavailable.dispose()
    indexedDB.open = open
    return { revision: preserved?.revision, corrupt: corrupt === null, malformed, missed }
  }, moduleUrl)
  expect(result).toEqual({ revision: 1, corrupt: true, malformed: null, missed: null })
  await application.selectOpenPath(path.resolve("tests/fixtures/pdfs/document-mock.pdf"))
  await application.page.getByRole("button", { name: "Choose a PDF" }).click()
  await expect(application.page.getByRole("spinbutton", { name: "Page number" })).toBeEnabled()
})
