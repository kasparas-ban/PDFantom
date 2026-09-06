import { expect, test } from "vitest"

import { normalizeMathDelimiters } from "../../src/renderer/src/sidebar/chat-markdown-math"

test("rewrites LaTeX inline delimiters to the ones remark-math parses", () => {
  expect(normalizeMathDelimiters(String.raw`Where \(\gamma^\mu\) are the Dirac matrices`)).toBe(
    String.raw`Where $\gamma^\mu$ are the Dirac matrices`,
  )
})

test("rewrites LaTeX display delimiters and trims the enclosed maths", () => {
  expect(normalizeMathDelimiters(String.raw`\[ (i\hbar \gamma^\mu \partial_\mu - mc) \psi = 0 \]`))
    .toBe(String.raw`$$(i\hbar \gamma^\mu \partial_\mu - mc) \psi = 0$$`)
})

test("rewrites every delimiter pair in a response", () => {
  expect(normalizeMathDelimiters(String.raw`\(a\) then \(b\) then \[c\]`)).toBe(
    String.raw`$a$ then $b$ then $$c$$`,
  )
})

test("leaves dollar-delimited maths untouched", () => {
  const text = String.raw`Inline $E = mc^2$ and display $$\frac{1}{2}$$`

  expect(normalizeMathDelimiters(text)).toBe(text)
})

test("leaves delimiters inside fenced code blocks alone", () => {
  const text = ["```python", String.raw`print("\(not maths\)")`, "```"].join("\n")

  expect(normalizeMathDelimiters(text)).toBe(text)
})

test("leaves delimiters inside an unterminated fence alone while streaming", () => {
  const text = ["```python", String.raw`print("\(not maths\)")`].join("\n")

  expect(normalizeMathDelimiters(text)).toBe(text)
})

test("leaves delimiters inside inline code spans alone", () => {
  const text = String.raw`Use \`\(x\)\` to open maths`.replaceAll("\\`", "`")

  expect(normalizeMathDelimiters(text)).toBe(text)
})

test("rewrites maths that sits alongside a code span", () => {
  expect(normalizeMathDelimiters(String.raw`\(x\) and \`\(y\)\``.replaceAll("\\`", "`"))).toBe(
    String.raw`$x$ and \`\(y\)\``.replaceAll("\\`", "`"),
  )
})
