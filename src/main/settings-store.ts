import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { z } from "zod"

const settingsSchema = z.object({
  codexExecutablePath: z.string().min(1).optional(),
})

export type AppSettings = z.infer<typeof settingsSchema>

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<AppSettings> {
    let contents: string

    try {
      contents = await readFile(this.filePath, "utf8")
    } catch (error) {
      if (isFileNotFoundError(error)) return {}
      throw error
    }

    const parsed = settingsSchema.safeParse(JSON.parse(contents))
    return parsed.success ? parsed.data : {}
  }

  async write(patch: Partial<AppSettings>) {
    const next = settingsSchema.parse({ ...(await this.read()), ...patch })
    const temporaryPath = `${this.filePath}.tmp`

    await mkdir(path.dirname(this.filePath), { recursive: true })

    try {
      await writeFile(temporaryPath, JSON.stringify(next, null, 2), { flag: "w" })
      await rename(temporaryPath, this.filePath)
    } finally {
      await rm(temporaryPath, { force: true })
    }

    return next
  }
}

function isFileNotFoundError(error: unknown) {
  return error instanceof Error && Reflect.get(error, "code") === "ENOENT"
}
