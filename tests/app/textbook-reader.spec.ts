import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createPdfFixtures } from "../fixtures/create-pdf-fixtures";
import { launchApplication } from "./launch-application";

test("a Student opens, reads, and selects text without a Model Provider", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-reader-"));
  const fixtures = await createPdfFixtures(path.join(workspace, "fixtures"));
  const application = await launchApplication({
    env: {
      ...process.env,
      PDFANTOM_TEST_OPEN_PATH: fixtures.selectable,
      PDFANTOM_TEST_PROFILE: path.join(workspace, "profile"),
    }
  });

  try {
    const { page } = application;
    await page.getByRole("button", { name: "Open textbook" }).click();

    await expect(page.getByRole("heading", { name: "selectable-textbook.pdf" })).toBeVisible();
    await expect(page.getByText("2 pages")).toBeVisible();
    await expect(page.getByText("Selectable text available")).toBeVisible();
    await expect(page.locator(".pdf-page > .canvasWrapper > canvas")).toHaveCount(2);

    const passage = page.getByText("Selectable textbook passage", { exact: true });
    await passage.selectText();
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toContain("Selectable textbook passage");
  } finally {
    await application.close();
    await rm(workspace, { recursive: true, force: true });
  }
});

test("an image-only scan remains viewable without offering text selection", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-scan-"));
  const fixtures = await createPdfFixtures(path.join(workspace, "fixtures"));
  const application = await launchApplication({
    env: {
      ...process.env,
      PDFANTOM_TEST_OPEN_PATH: fixtures.imageOnly,
      PDFANTOM_TEST_PROFILE: path.join(workspace, "profile"),
    },
  });

  try {
    const { page } = application;
    await page.getByRole("button", { name: "Open textbook" }).click();

    await expect(page.getByRole("heading", { name: "image-only-scan.pdf" })).toBeVisible();
    await expect(page.getByText("1 page", { exact: true })).toBeVisible();
    await expect(page.getByText("No selectable text — scanned pages remain viewable")).toBeVisible();
    await expect(page.locator(".pdf-page > .canvasWrapper > canvas")).toHaveCount(1);
    await expect(page.locator(".textLayer span")).toHaveCount(0);
  } finally {
    await application.close();
    await rm(workspace, { recursive: true, force: true });
  }
});

test("the renderer exposes only the constrained Textbook boundary", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-security-"));
  const application = await launchApplication({
    env: {
      ...process.env,
      PDFANTOM_TEST_PROFILE: path.join(workspace, "profile"),
    },
  });

  try {
    const { page } = application;
    await expect(page.getByRole("button", { name: "Open textbook" })).toBeVisible();

    const boundary = await page.evaluate(() => ({
      api: Object.keys(window.pdfantom),
      ipcRenderer: typeof (window as Window & { ipcRenderer?: unknown }).ipcRenderer,
      nodeProcess: typeof (window as Window & { process?: unknown }).process,
      nodeRequire: typeof (window as Window & { require?: unknown }).require,
    }));
    expect(boundary).toEqual({
      api: ["openTextbook"],
      ipcRenderer: "undefined",
      nodeProcess: "undefined",
      nodeRequire: "undefined",
    });

    await expect
      .poll(() =>
        page.evaluate(async () => {
          try {
            await fetch("https://example.com/");
            return "allowed";
          } catch {
            return "blocked";
          }
        }),
      )
      .toBe("blocked");

    const originalUrl = page.url();
    expect(await page.evaluate(() => window.open("https://example.com/"))).toBeNull();
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "https://example.com/";
      document.body.append(link);
      link.click();
    });
    await expect.poll(() => page.url()).toBe(originalUrl);
  } finally {
    await application.close();
    await rm(workspace, { recursive: true, force: true });
  }
});
