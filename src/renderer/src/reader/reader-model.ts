import { z } from "zod"

export const MIN_PDF_SCALE = 0.25
export const MAX_PDF_SCALE = 5

export const readerViewSchema = z.object({
  zoom: z.number().min(MIN_PDF_SCALE).max(MAX_PDF_SCALE),
  scalePreset: z.enum(["page-fit", "page-height", "page-width"]).nullable(),
  pageLayout: z.enum(["vertical", "horizontal"]),
  pageView: z.enum(["single", "double"]),
})

export const DEFAULT_READER_VIEW = Object.freeze({
  zoom: 1,
  scalePreset: "page-fit",
  pageLayout: "vertical",
  pageView: "single",
} satisfies z.infer<typeof readerViewSchema>)

export const readingPositionSchema = z
  .object({
    pageNumber: z.int().positive(),
    offsetX: z.number(),
    offsetY: z.number(),
    ...readerViewSchema.shape,
  })
  .readonly()

export type ReadingPosition = z.infer<typeof readingPositionSchema>
export type PDFScalePreset = NonNullable<ReadingPosition["scalePreset"]>
export type PDFPageLayout = ReadingPosition["pageLayout"]
export type PDFPageView = ReadingPosition["pageView"]
