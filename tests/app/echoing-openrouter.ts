import type { launchTestApplication } from "./launch-application"

type Application = Awaited<ReturnType<typeof launchTestApplication>>

export type OpenRouterRequestBody = {
  model: string
  messages: { role: string; content: unknown }[]
}

export async function installEchoingOpenRouter(application: Application) {
  await application.page.evaluate(() => window.pdfantom.saveOpenRouterApiKey("sk-or-test"))
  await application.electronApplication.evaluate(() => {
    const bodies: { model: string; messages: { role: string; content: unknown }[] }[] = []
    Reflect.set(globalThis, "chatBodies", bodies)

    globalThis.fetch = async (_input, init) => {
      if (typeof init?.body !== "string") throw new Error("Expected a JSON request body")

      const body = JSON.parse(init.body)
      bodies.push(body)
      const content: string = body.messages.at(-1).content
      const prompt = content.split("\n").at(-1)

      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Reply to ${prompt}` } }] })}\n\ndata: [DONE]\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )
    }
  })

  return () =>
    application.electronApplication.evaluate(() => {
      const bodies: OpenRouterRequestBody[] = Reflect.get(globalThis, "chatBodies")

      return bodies
    })
}
