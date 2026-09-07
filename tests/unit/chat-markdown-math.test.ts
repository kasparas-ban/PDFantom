import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Markdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import { expect, test } from "vitest"

import {
  normalizeMathDelimiters,
  remarkDisplayMath,
} from "../../src/renderer/src/sidebar/chat-markdown-math"

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

test("joins the lines of a `$$` equation broken across lines", () => {
  const text = [
    "3. **Lagrange's equation**",
    String.raw`   $$\frac{d}{dt}\frac{\partial L}{\partial \dot q_i}`,
    String.raw`   -\frac{\partial L}{\partial q_i}=0$$ A general framework.`,
  ].join("\n")

  expect(normalizeMathDelimiters(text)).toBe(
    [
      "3. **Lagrange's equation**",
      String.raw`   $$\frac{d}{dt}\frac{\partial L}{\partial \dot q_i} -\frac{\partial L}{\partial q_i}=0$$ A general framework.`,
    ].join("\n"),
  )
})

test("joins the lines of LaTeX display maths broken across lines", () => {
  expect(normalizeMathDelimiters(String.raw`\[G_{\mu\nu}` + "\n" + String.raw`=T_{\mu\nu}\]`)).toBe(
    String.raw`$$G_{\mu\nu} =T_{\mu\nu}$$`,
  )
})

test("leaves a fenced `$$` block untouched", () => {
  const text = "Rule:\n\n$$\nP = |\\psi|^2\n$$\n\nDone."

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

function renderMarkdown(text: string) {
  return renderToStaticMarkup(
    createElement(
      Markdown,
      { remarkPlugins: [remarkMath, remarkDisplayMath], rehypePlugins: [rehypeKatex] },
      normalizeMathDelimiters(text),
    ),
  )
}

test("renders single-line `$$` maths in display mode", () => {
  expect(renderMarkdown("The rule:\n\n$$P = |\\psi|^2$$\n\nDone.")).toContain("katex-display")
})

test("renders LaTeX display delimiters in display mode", () => {
  expect(renderMarkdown(String.raw`The rule \[P = |\psi|^2\] gives probabilities.`)).toContain(
    "katex-display",
  )
})

test("renders `$$` maths inside a list item in display mode", () => {
  const html = renderMarkdown("1. **Born rule** $$P = |\\psi|^2$$ gives probabilities.")

  expect(html).toContain("<li>")
  expect(html).toContain("katex-display")
})

test("keeps fenced `$$` maths in display mode", () => {
  expect(renderMarkdown("$$\nP = |\\psi|^2\n$$")).toContain("katex-display")
})

test("renders a `$$` equation broken across lines in display mode without errors", () => {
  const html = renderMarkdown(
    [
      "7. **Einstein field equation**",
      String.raw`   $$G_{\mu\nu}+\Lambda g_{\mu\nu}`,
      String.raw`   =\frac{8\pi G}{c^4}T_{\mu\nu}$$ Relates curvature to energy.`,
    ].join("\n"),
  )

  expect(html).toContain("katex-display")
  expect(html).not.toContain("katex-error")
  expect(html).toContain("Relates curvature to energy.")
})

test("keeps single-dollar and LaTeX inline maths inline", () => {
  const html = renderMarkdown(String.raw`Where $\hbar$ and \(\gamma^\mu\) appear in a sentence.`)

  expect(html).toContain('class="katex"')
  expect(html).not.toContain("katex-display")
})
