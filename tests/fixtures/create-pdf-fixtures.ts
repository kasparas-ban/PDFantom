import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PNG } from "pngjs";

export interface PdfFixtures {
  readonly imageOnly: string;
  readonly selectable: string;
}

function createScannedPageImage(): Buffer {
  const image = new PNG({ height: 420, width: 320 });

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (image.width * y + x) * 4;
      const isHeading = y >= 42 && y < 55 && x >= 35 && x < 230;
      const lineNumber = Math.floor((y - 82) / 24);
      const lineWidth = 235 - (lineNumber % 3) * 24;
      const isBodyLine =
        y >= 82 &&
        y < 330 &&
        (y - 82) % 24 < 4 &&
        x >= 35 &&
        x < 35 + lineWidth;
      const isFigure = y >= 344 && y < 382 && x >= 72 && x < 248;
      const ink = isHeading || isBodyLine;

      image.data[offset] = ink ? 54 : isFigure ? 139 : 242;
      image.data[offset + 1] = ink ? 57 : isFigure ? 161 : 239;
      image.data[offset + 2] = ink ? 52 : isFigure ? 146 : 228;
      image.data[offset + 3] = 255;
    }
  }

  return PNG.sync.write(image);
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
  const scannedPageImage = await imageOnlyDocument.embedPng(createScannedPageImage());
  scannedPage.drawImage(scannedPageImage, { height: 684, width: 504, x: 54, y: 54 });
  const imageOnly = path.join(directory, "image-only-scan.pdf");
  await writeFile(imageOnly, await imageOnlyDocument.save());

  return { imageOnly, selectable };
}
