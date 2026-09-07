import { DocumentReaderDriver } from "./drivers/document-reader-driver"
import { expect, test } from "./test"

const MARKDOWN_RESPONSE = [
  "## Foundational Relations",
  "",
  "| Equation | Meaning |",
  "|---|---|",
  "| `E = hv` | Photon energy |",
  "",
  "- A bullet with **bold** text",
  "",
  "```python",
  "def normalize(psi):",
  "    return psi",
  "```",
  "",
  "$$E = mc^2$$",
].join("\n")

// A `$$` equation the model broke across lines, with the opening `$$` starting a
// line. remark-math reads that as a display fence and drops the first line.
const SPLIT_MATH_RESPONSE = [
  "- **Lagrange's equation:**",
  String.raw`  $$\frac{d}{dt}\frac{\partial L}{\partial \dot q_i}`,
  String.raw`  -\frac{\partial L}{\partial q_i}=0$$ A powerful general formulation of mechanics.`,
  "- **Lorentz force law:**",
  String.raw`  $\mathbf F = q(\mathbf E + \mathbf v \times \mathbf B)$ Describes how fields act on charges.`,
].join("\n")

test("renders Assistant Message markdown as formatted elements", async ({ application }) => {
  const reader = await sendMockedResponse(application, MARKDOWN_RESPONSE)

  await expect(
    reader.chatPanel.getByRole("heading", { name: "Foundational Relations" }),
  ).toBeVisible()
  await expect(reader.chatPanel.getByRole("table")).toBeVisible()
  await expect(reader.chatPanel.getByRole("cell", { name: "Photon energy" })).toBeVisible()
  await expect(reader.chatPanel.getByRole("listitem")).toContainText("A bullet with bold text")
  await expect(reader.chatPanel.getByText("python", { exact: true })).toBeVisible()
  await expect(reader.chatPanel.getByRole("button", { name: "Copy code" })).toBeVisible()
  await expect(reader.chatPanel.locator(".katex-display")).toBeVisible()
})

test("renders a display equation broken across lines without KaTeX errors", async ({
  application,
}) => {
  const reader = await sendMockedResponse(application, SPLIT_MATH_RESPONSE)

  await expect(reader.chatPanel.locator(".katex-display")).toBeVisible()
  await expect(reader.chatPanel.locator(".katex-error")).toHaveCount(0)
  await expect(reader.chatPanel.getByRole("listitem").first()).toContainText(
    "A powerful general formulation of mechanics.",
  )
  await expect(reader.chatPanel.getByRole("listitem").first()).not.toContainText("$$")
  await expect(reader.chatPanel.locator(".katex:not(.katex-display .katex)")).toHaveCount(1)
})

async function sendMockedResponse(
  application: Parameters<Parameters<typeof test>[2]>[0]["application"],
  markdown: string,
) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  // Electron's `evaluate` passes the `electron` module first and the argument second.
  await application.electronApplication.evaluate((_electron, content) => {
    globalThis.fetch = async () =>
      new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )
  }, markdown)

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Explain the basics")
  await reader.chatSendMessageButton.click()

  return reader
}
