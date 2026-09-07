import path from "node:path"

import { expect, test } from "vitest"

import {
  codexExecutableCandidates,
  isSupportedCodexVersion,
  MINIMUM_CODEX_VERSION,
  parseCodexVersion,
} from "../../../src/main/codex/executable"

test("a Settings override replaces every other install root", () => {
  expect(
    codexExecutableCandidates({
      overridePath: "/custom/codex",
      env: { PATH: "/usr/bin" },
      homeDirectory: "/Users/student",
    }),
  ).toEqual(["/custom/codex"])
})

test("known install roots are probed before PATH and never through a login shell", () => {
  const candidates = codexExecutableCandidates({
    overridePath: null,
    env: {
      CODEX_HOME: "/Volumes/codex-home",
      PATH: ["/usr/bin", "/opt/tools/bin", ""].join(path.delimiter),
    },
    homeDirectory: "/Users/student",
  })

  expect(candidates).toEqual([
    "/Volumes/codex-home/packages/standalone/current/bin/codex",
    "/Users/student/.local/bin/codex",
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
    "/usr/bin/codex",
    "/opt/tools/bin/codex",
  ])
})

test("CODEX_HOME defaults to ~/.codex", () => {
  expect(
    codexExecutableCandidates({ overridePath: null, env: {}, homeDirectory: "/Users/student" })[0],
  ).toBe("/Users/student/.codex/packages/standalone/current/bin/codex")
})

test("parses the version out of `codex --version`", () => {
  expect(parseCodexVersion("codex-cli 0.152.0\n")).toBe("0.152.0")
  expect(parseCodexVersion("garbage")).toBeNull()
})

test("requires the verified minimum version", () => {
  expect(isSupportedCodexVersion(MINIMUM_CODEX_VERSION)).toBe(true)
  expect(isSupportedCodexVersion("0.152.1")).toBe(true)
  expect(isSupportedCodexVersion("1.0.0")).toBe(true)
  expect(isSupportedCodexVersion("0.151.9")).toBe(false)
  expect(isSupportedCodexVersion("0.99.0")).toBe(false)
})
