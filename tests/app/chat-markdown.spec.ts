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

test("renders Assistant Message markdown as formatted elements", async ({ application }) => {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate((markdown) => {
    globalThis.fetch = async () =>
      new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: markdown } }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )
  }, MARKDOWN_RESPONSE)

  const reader = new DocumentReaderDriver(application.page)
  await reader.toggleChatPanel("Show")
  await reader.writeChatMessage("Explain the basics")
  await reader.chatSendMessageButton.click()

  await expect(
    reader.chatPanel.getByRole("heading", { name: "Foundational Relations" }),
  ).toBeVisible()
  await expect(reader.chatPanel.getByRole("table")).toBeVisible()
  await expect(reader.chatPanel.getByRole("cell", { name: "Photon energy" })).toBeVisible()
  await expect(reader.chatPanel.getByRole("listitem")).toContainText("A bullet with bold text")
  await expect(reader.chatPanel.getByText("python", { exact: true })).toBeVisible()
  await expect(reader.chatPanel.getByRole("button", { name: "Copy code" })).toBeVisible()
})
