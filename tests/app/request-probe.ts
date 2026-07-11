import { once } from "node:events"
import { createServer } from "node:http"

export async function startRequestProbe() {
  let requestCount = 0
  const server = createServer((_request, response) => {
    requestCount += 1
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain",
    })
    response.end("allowed")
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")

  const address = server.address()
  if (!address || typeof address === "string") {
    server.close()
    throw new Error("Request probe did not bind to a TCP port")
  }

  return {
    url: `http://127.0.0.1:${address.port}/probe`,
    get requestCount() {
      return requestCount
    },
    close: async () => {
      server.close()
      await once(server, "close")
    },
  }
}
