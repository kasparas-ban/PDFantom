import { expect, test } from "@playwright/test"
import type { PDFWorker } from "pdfjs-dist"

import type { ReaderPreview } from "../../src/renderer/src/reader-preview"
import { ReaderWorkspace, type ReaderSurface } from "../../src/renderer/src/reader-workspace"
import { createReaderSessionStore } from "../../src/renderer/src/store/reader-session-store"
import type {
  DocumentApi,
  DocumentLoadResult,
  DocumentSummary,
  DocumentOpenResult,
} from "../../src/shared/document-api"

const documents = ["A", "B", "C", "D", "E"].map((id) => ({
  id,
  name: `${id}.pdf`,
  fingerprint: id.toLowerCase().repeat(64),
}))
const verified = (document: DocumentSummary): DocumentLoadResult => ({
  status: "verified",
  document,
  bytes: new ArrayBuffer(1),
})
const previewRecord: ReaderPreview = {
  key: `A:${documents[0].fingerprint}`,
  documentId: "A",
  fingerprint: documents[0].fingerprint,
  position: {
    pageNumber: 1,
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    scalePreset: null,
    pageView: "single",
    pageLayout: "vertical",
  },
  pageCount: 5,
  width: 800,
  height: 600,
  density: 1,
  background: "white",
  blob: new Blob(["image"], { type: "image/png" }),
  bytes: 5,
  generation: "test",
  revision: 1,
  lastUsed: 1,
}

function workspaceFixture(workerStartup = () => Promise.resolve()) {
  let selected: DocumentSummary | null = null
  let workerCount = 0
  let workerDestroyed = 0
  const records = new Map<string, string>()
  const store = createReaderSessionStore({
    getItem: (key) => records.get(key) ?? null,
    removeItem: (key) => {
      records.delete(key)
    },
    setItem: (key, value) => {
      records.set(key, value)
    },
  })
  const pending = new Map<string, Promise<DocumentLoadResult>>()
  const calls: { id: string; bytesNeeded: boolean }[] = []
  const created: {
    id: string
    disposed: boolean
    mode: string
    ready: (interactive?: boolean) => void
    fail: () => void
  }[] = []
  const invalidations: string[] = []
  const preview = Promise.withResolvers<ReaderPreview | null>()
  let opened = Promise.resolve<DocumentOpenResult | null>(null)
  const api: DocumentApi = {
    getDocumentLibrary: async () => ({ selectedDocument: selected, documents }),
    activateDocument: async (id) => {
      selected = documents.find((document) => document.id === id)!
      return { selectedDocument: selected, documents }
    },
    loadDocument: async (id, _fingerprint, bytesNeeded) => {
      calls.push({ id, bytesNeeded })
      return pending.get(id) ?? verified(documents.find((document) => document.id === id)!)
    },
    openDocument: () => opened,
  }
  let previewVisible = false
  let previewDisposed = 0
  let appearance = { width: 800, height: 600, density: 1, background: "white" }
  const decoding = Promise.withResolvers<void>()
  let delayDecoding = false
  const owner = new ReaderWorkspace(
    api,
    store,
    {
      appearance: () => appearance,
      create: (document, _worker, onStatus) => {
        let ready = false
        const entry = {
          id: document.id,
          disposed: false,
          mode: "preparing",
          ready: (interactive = true) => {
            ready = true
            onStatus({ state: "ready", interactive })
          },
          fail: () => onStatus({ state: "failed", message: "Invalid PDF" }),
        }
        created.push(entry)
        const surface: ReaderSurface = {
          runtime: {
            destroy: async () => {},
            flushPosition: () => {},
            isReady: () => (ready ? { interactive: true } : null),
            reconcileLayout: () => {},
            setLifecycle: () => {},
            setScale: () => {},
            setPageView: () => {},
            setPageLayout: () => {},
            goToPage: () => {},
          },
          compatible: () => true,
          prepare: () => {
            entry.mode = "preparing"
          },
          show: () => {
            entry.mode = "presented"
          },
          hide: () => {
            entry.mode = "inactive"
          },
          capture: async () => null,
          dispose: async () => {
            entry.disposed = true
          },
        }
        return surface
      },
      preview: async () => {
        if (delayDecoding) await decoding.promise
        return {
          show: () => {
            previewVisible = true
          },
          dispose: () => {
            previewVisible = false
            previewDisposed++
          },
        }
      },
    },
    {
      read: () => preview.promise,
      write: async () => {},
      invalidate: async (document) => {
        invalidations.push(document.id)
      },
      ticket: () => ({ generation: crypto.randomUUID(), revision: 1, valid: () => true }),
      dispose: () => {},
    },
    () => {
      workerCount++
      // This is the explicit worker boundary; no PDF.js worker runs in owner tests.
      // eslint-disable-next-line typescript/no-unsafe-type-assertion -- Minimal worker lifetime test double.
      return {
        promise: workerStartup(),
        destroy: () => {
          workerDestroyed++
        },
      } as PDFWorker
    },
  )
  return {
    owner,
    api,
    store,
    pending,
    calls,
    created,
    preview,
    invalidations,
    selected: () => selected,
    workerCount: () => workerCount,
    workerDestroyed: () => workerDestroyed,
    previewVisible: () => previewVisible,
    previewDisposed: () => previewDisposed,
    delayPreviewDecoding: () => {
      delayDecoding = true
    },
    finishDecoding: () => decoding.resolve(),
    setAppearance: (next: typeof appearance) => {
      appearance = next
    },
    setOpen: (value: Promise<DocumentOpenResult | null>) => {
      opened = value
    },
  }
}

test("keeps A during B preparation and reuses A before delayed verification finishes", async () => {
  const fixture = workspaceFixture()
  const { owner, store, created, pending, calls } = fixture
  await owner.restore()
  await owner.activate("A")
  created[0].ready()
  await owner.activate("B")
  expect(store.getState().activeDocument).toMatchObject({ document: { id: "A" } })
  created[1].ready()
  const check = Promise.withResolvers<DocumentLoadResult>()
  pending.set("A", check.promise)
  const activation = owner.activate("A")
  expect(store.getState().activeDocument).toMatchObject({ document: { id: "A" } })
  expect(store.getState().interactive).toBe(true)
  expect(store.getState().sourceStatus).toBe("checking")
  expect(calls.at(-1)).toEqual({ id: "A", bytesNeeded: false })
  expect(created).toHaveLength(2)
  check.resolve(verified(documents[0]))
  await activation
  await owner.activate("A")
  expect(calls).toHaveLength(3)
  await owner.dispose()
})

test("out-of-order successes and failures cannot steal C's presentation or persisted selection", async () => {
  const fixture = workspaceFixture()
  const { owner, pending, created, store } = fixture
  await owner.restore()
  const a = Promise.withResolvers<DocumentLoadResult>()
  const b = Promise.withResolvers<DocumentLoadResult>()
  pending.set("A", a.promise)
  pending.set("B", b.promise)
  const first = owner.activate("A")
  const second = owner.activate("B")
  await owner.activate("C")
  created[0].ready()
  a.resolve(verified(documents[0]))
  b.resolve({ status: "unavailable", document: documents[1], reason: "missing" })
  await Promise.all([first, second])
  expect(created).toHaveLength(1)
  expect(fixture.selected()?.id).toBe("C")
  expect(store.getState()).toMatchObject({ activeDocument: { document: { id: "C" } }, error: null })
  await owner.dispose()
})

test("LRU eviction releases inactive readers but not displayed/incoming readers or the worker", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  for (const id of ["A", "B", "C"]) {
    // eslint-disable-next-line no-await-in-loop -- Each activation becomes visible before the next user action.
    await fixture.owner.activate(id)
    fixture.created.at(-1)!.ready()
  }
  await fixture.owner.activate("A")
  await fixture.owner.activate("D")
  expect(fixture.created.filter((entry) => !entry.disposed).map(({ id }) => id)).toEqual([
    "A",
    "C",
    "D",
  ])
  expect(fixture.created[0].mode).toBe("presented")
  fixture.created.at(-1)!.ready()
  expect(fixture.workerCount()).toBe(1)
  expect(fixture.workerDestroyed()).toBe(0)
  await fixture.owner.activate("B")
  fixture.created.at(-1)!.ready()
  expect(fixture.created.filter(({ id }) => id === "B")).toHaveLength(2)
  await fixture.owner.dispose()
  expect(fixture.created.every(({ disposed }) => disposed)).toBe(true)
  expect(fixture.workerDestroyed()).toBe(1)
})

test("older verification failure cannot invalidate a newer successfully rechecked version", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  await fixture.owner.activate("A")
  fixture.created[0].ready()
  await fixture.owner.activate("B")
  fixture.created[1].ready()
  const old = Promise.withResolvers<DocumentLoadResult>()
  fixture.pending.set("A", old.promise)
  const first = fixture.owner.activate("A")
  await fixture.owner.activate("B")
  fixture.pending.delete("A")
  await fixture.owner.activate("A")
  old.resolve({ status: "unavailable", document: documents[0], reason: "missing" })
  await first
  expect(fixture.created[0].disposed).toBe(false)
  expect(fixture.store.getState().activeDocument).toMatchObject({ document: { id: "A" } })
  await fixture.owner.dispose()
})

test("failure invalidates cached content and a late preview cannot resurrect it", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  fixture.pending.set(
    "A",
    Promise.resolve({ status: "unavailable", document: documents[0], reason: "missing" }),
  )
  await fixture.owner.activate("A")
  fixture.preview.resolve(previewRecord)
  await Promise.resolve()
  await Promise.resolve()
  expect(fixture.previewVisible()).toBe(false)
  expect(fixture.store.getState().activeDocument).toMatchObject({
    status: "unavailable",
    reason: "missing",
  })
  await fixture.owner.dispose()
})

test("a slow preview cannot delay or cover a ready live reader", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  await fixture.owner.activate("A")
  fixture.created[0].ready()
  fixture.preview.resolve(previewRecord)
  await Promise.resolve()
  await Promise.resolve()
  expect(fixture.previewVisible()).toBe(false)
  expect(fixture.store.getState().activeDocument.status).toBe("loaded")
  await fixture.owner.dispose()
})

test("preview-only navigation is unavailable and failure removes the bitmap", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  const load = Promise.withResolvers<DocumentLoadResult>()
  fixture.pending.set("A", load.promise)
  const opening = fixture.owner.activate("A")
  fixture.preview.resolve(previewRecord)
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(fixture.previewVisible()).toBe(true)
  expect(fixture.store.getState().interactive).toBe(false)
  load.resolve({ status: "unavailable", document: documents[0], reason: "content-mismatch" })
  await opening
  expect(fixture.previewVisible()).toBe(false)
  expect(fixture.store.getState().activeDocument.status).toBe("unavailable")
  await fixture.owner.dispose()
})

test("selection failure reconciles with the confirmed metadata without silently claiming persistence", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  await fixture.owner.activate("A")
  fixture.created[0].ready()
  fixture.api.activateDocument = async () => {
    throw new Error("disk failure")
  }
  await fixture.owner.activate("B")
  expect(fixture.store.getState().selectedDocument?.id).toBe("A")
  expect(fixture.store.getState().error).toContain("selection could not be saved")
  await fixture.owner.dispose()
})

test("teardown before a pending load resolves never constructs a reader or leaks a worker", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  fixture.owner.warm()
  fixture.owner.warm()
  const load = Promise.withResolvers<DocumentLoadResult>()
  fixture.pending.set("A", load.promise)
  const opening = fixture.owner.activate("A")
  await fixture.owner.dispose()
  load.resolve(verified(documents[0]))
  await opening
  expect(fixture.created).toHaveLength(0)
  expect(fixture.workerCount()).toBe(1)
  expect(fixture.workerDestroyed()).toBe(1)
})

test("picker cancellation and late picker results do not change selection", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  await fixture.owner.open()
  expect(fixture.selected()).toBeNull()
  const picker = Promise.withResolvers<DocumentOpenResult | null>()
  fixture.setOpen(picker.promise)
  const opening = fixture.owner.open()
  await fixture.owner.activate("C")
  fixture.created[0].ready()
  picker.resolve({
    document: { ...documents[0], bytes: new ArrayBuffer(1) },
    previousFingerprint: null,
    library: { selectedDocument: null, documents },
  })
  await opening
  expect(fixture.selected()?.id).toBe("C")
  expect(fixture.created).toHaveLength(1)
  await fixture.owner.dispose()
})

test("failed worker startup releases preparing readers and permits an explicit retry", async () => {
  const startup = Promise.withResolvers<void>()
  let attempts = 0
  const fixture = workspaceFixture(() => (attempts++ ? Promise.resolve() : startup.promise))
  await fixture.owner.restore()
  await fixture.owner.activate("A")
  startup.reject(new Error("Worker startup failed"))
  await expect.poll(fixture.workerDestroyed).toBe(1)
  expect(fixture.created[0].disposed).toBe(true)
  expect(fixture.store.getState().error).toContain("could not start")
  fixture.created[0].ready()
  expect(fixture.store.getState().activeDocument.status).toBe("none")
  await fixture.owner.activate("A")
  fixture.created[1].ready()
  expect(fixture.store.getState().activeDocument.status).toBe("loaded")
  expect(fixture.workerCount()).toBe(2)
  await fixture.owner.dispose()
  expect(fixture.workerDestroyed()).toBe(2)
})

test("a setup-cleanup-setup cycle ignores late worker startup from the disposed owner", async () => {
  const startup = Promise.withResolvers<void>()
  const first = workspaceFixture(() => startup.promise)
  first.owner.warm()
  await first.owner.dispose()
  const second = workspaceFixture()
  await second.owner.restore()
  await second.owner.activate("A")
  second.created[0].ready()
  startup.reject(new Error("Disposed during startup"))
  await Promise.resolve()
  expect(first.workerDestroyed()).toBe(1)
  expect(first.store.getState().error).toBeNull()
  expect(second.workerCount()).toBe(1)
  expect(second.store.getState().activeDocument.status).toBe("loaded")
  await second.owner.dispose()
})

test("loads and retained verification finish hidden without preparation or revelation", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  await fixture.owner.activate("A")
  fixture.created[0].ready()
  const load = Promise.withResolvers<DocumentLoadResult>()
  fixture.pending.set("B", load.promise)
  const activation = fixture.owner.activate("B")
  fixture.owner.suspend(true)
  load.resolve(verified(documents[1]))
  await activation
  fixture.created[1].ready()
  expect(fixture.created.map(({ mode }) => mode)).toEqual(["inactive", "inactive"])
  await fixture.owner.activate("A")
  expect(fixture.created[0].mode).toBe("inactive")
  fixture.owner.suspend(false)
  fixture.owner.suspend(false)
  expect(fixture.created[0].mode).toBe("presented")
  expect(fixture.created[1].mode).toBe("inactive")
  fixture.owner.suspend(true)
  await fixture.owner.activate("B")
  fixture.owner.suspend(false)
  expect(fixture.created[1].mode).toBe("presented")
  expect(fixture.workerCount()).toBe(1)
  await fixture.owner.dispose()
})

test("decoded previews are disposed while hidden and retried only for a compatible active target", async () => {
  const fixture = workspaceFixture()
  await fixture.owner.restore()
  fixture.delayPreviewDecoding()
  await fixture.owner.activate("A")
  fixture.preview.resolve(previewRecord)
  await Promise.resolve()
  fixture.owner.suspend(true)
  fixture.finishDecoding()
  await expect.poll(fixture.previewDisposed).toBe(1)
  expect(fixture.previewVisible()).toBe(false)
  fixture.owner.suspend(false)
  await expect.poll(fixture.previewVisible).toBe(true)
  fixture.owner.suspend(true)
  fixture.setAppearance({ width: 0, height: 0, density: 1, background: "black" })
  fixture.owner.layoutChanged()
  expect(fixture.created[0].mode).toBe("inactive")
  fixture.setAppearance({ width: 800, height: 600, density: 1, background: "white" })
  fixture.owner.suspend(false)
  fixture.created[0].ready()
  expect(fixture.previewVisible()).toBe(false)
  expect(fixture.created[0].mode).toBe("presented")
  await fixture.owner.dispose()
})
