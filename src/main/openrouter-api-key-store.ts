import { randomUUID } from "node:crypto"
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

type Encryption = {
  readonly decryptString: (encrypted: Buffer) => string
  readonly encryptString: (plainText: string) => Buffer
  readonly isEncryptionAvailable: () => boolean
}

export class OpenRouterApiKeyStore {
  constructor(
    private readonly storagePath: string,
    private readonly encryption: Encryption,
  ) {}

  async getApiKey() {
    let encrypted: Buffer

    try {
      encrypted = await readFile(this.storagePath)
    } catch (error) {
      if (isFileNotFoundError(error)) return null
      throw error
    }

    this.assertEncryptionAvailable()
    const apiKey = this.encryption.decryptString(encrypted)
    return apiKey.length > 0 ? apiKey : null
  }

  async hasApiKey() {
    return (await this.getApiKey()) !== null
  }

  async saveApiKey(apiKey: string) {
    if (apiKey.length === 0) {
      await rm(this.storagePath, { force: true })
      return
    }

    this.assertEncryptionAvailable()
    const encrypted = this.encryption.encryptString(apiKey)
    const storageDirectory = path.dirname(this.storagePath)
    const temporaryPath = `${this.storagePath}.${randomUUID()}.tmp`

    await mkdir(storageDirectory, { mode: 0o700, recursive: true })

    try {
      await writeFile(temporaryPath, encrypted, { flag: "wx", mode: 0o600 })
      await rename(temporaryPath, this.storagePath)
      await chmod(this.storagePath, 0o600)
    } finally {
      await rm(temporaryPath, { force: true })
    }
  }

  private assertEncryptionAvailable() {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error("Secure storage is unavailable.")
    }
  }
}

function isFileNotFoundError(error: unknown) {
  return error instanceof Error && Reflect.get(error, "code") === "ENOENT"
}
