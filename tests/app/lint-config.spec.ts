import { spawnSync } from "node:child_process"
import { rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

test("lint enforces the if statement brace policy without applying it to loops", () => {
  const fixture = path.resolve(`tests/.if-braces-lint-${process.pid}.ts`)

  writeFileSync(
    fixture,
    `
export function invalid(value: boolean) {
  if (value) {
    return
  }

  if (value)
    return
}

export function loop(values: boolean[]) {
  for (const value of values)
    if (value) return
}
`,
  )

  try {
    const result = spawnSync("node_modules/.bin/vp", ["lint", fixture], {
      cwd: path.resolve(),
      encoding: "utf8",
    })
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(1)
    expect(output).toContain("Remove unnecessary braces from this single-line if statement.")
    expect(output).toContain("Add braces to this multiline if statement.")
    expect(output).not.toContain("Expected { after 'for' condition")
  } finally {
    rmSync(fixture, { force: true })
  }
})
