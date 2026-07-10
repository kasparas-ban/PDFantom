import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PdfFixtures {
  readonly imageOnly: string;
  readonly selectable: string;
}

export async function createPdfFixtures(directory: string): Promise<PdfFixtures> {
  await mkdir(directory, { recursive: true });

  const selectableDocument = await PDFDocument.create();
  const font = await selectableDocument.embedFont(StandardFonts.Helvetica);
  const firstPage = selectableDocument.addPage([612, 792]);
  firstPage.drawText("Selectable textbook passage", {
    x: 72,
    y: 700,
    font,
    size: 18,
    color: rgb(0.08, 0.12, 0.1),
  });
  const secondPage = selectableDocument.addPage([612, 792]);
  secondPage.drawText("A second page for reading", {
    x: 72,
    y: 700,
    font,
    size: 18,
    color: rgb(0.08, 0.12, 0.1),
  });
  const selectable = path.join(directory, "selectable-textbook.pdf");
  await writeFile(selectable, await selectableDocument.save());

  const imageOnlyDocument = await PDFDocument.create();
  const scannedPage = imageOnlyDocument.addPage([612, 792]);
  scannedPage.drawRectangle({
    x: 72,
    y: 560,
    width: 468,
    height: 140,
    color: rgb(0.86, 0.89, 0.84),
    borderColor: rgb(0.18, 0.25, 0.21),
    borderWidth: 2,
  });
  const imageOnly = path.join(directory, "image-only-scan.pdf");
  await writeFile(imageOnly, await imageOnlyDocument.save());

  return { imageOnly, selectable };
}
