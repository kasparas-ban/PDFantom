import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { expect, test } from "@playwright/test"

import { OpenRouterApiKeyStore } from "../../src/main/openrouter-api-key-store"

const encryption = {
  decryptString: (encrypted: Buffer) =>
    Buffer.from(encrypted.toString().replace(/^encrypted:/, ""), "base64").toString(),
  encryptString: (plainText: string) =>
    Buffer.from(`encrypted:${Buffer.from(plainText).toString("base64")}`),
  isEncryptionAvailable: () => true,
}

test("encrypts and restores the OpenRouter API key", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-api-key-"))
  const storagePath = path.join(workspace, "secrets", "openrouter-api-key")
  const apiKey = "sk-or-v1-example-secret"

  try {
    const store = new OpenRouterApiKeyStore(storagePath, encryption)
    expect(await store.hasApiKey()).toBe(false)

    await store.saveApiKey(apiKey)

    expect((await readFile(storagePath)).includes(apiKey)).toBe(false)
    expect((await stat(storagePath)).mode & 0o777).toBe(0o600)
    expect(await new OpenRouterApiKeyStore(storagePath, encryption).getApiKey()).toBe(apiKey)
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("removes the saved OpenRouter API key when saving an empty value", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-api-key-"))
  const storagePath = path.join(workspace, "secrets", "openrouter-api-key")

  try {
    const store = new OpenRouterApiKeyStore(storagePath, encryption)
    await store.saveApiKey("sk-or-v1-example-secret")
    await store.saveApiKey("")

    expect(await store.getApiKey()).toBeNull()
    await expect(readFile(storagePath)).rejects.toMatchObject({ code: "ENOENT" })
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})

test("refuses to save the API key without secure encryption", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "pdfantom-api-key-"))
  const storagePath = path.join(workspace, "openrouter-api-key")
  const store = new OpenRouterApiKeyStore(storagePath, {
    ...encryption,
    isEncryptionAvailable: () => false,
  })

  try {
    await expect(store.saveApiKey("sk-or-v1-example-secret")).rejects.toThrow(
      "Secure storage is unavailable.",
    )
  } finally {
    await rm(workspace, { force: true, recursive: true })
  }
})
