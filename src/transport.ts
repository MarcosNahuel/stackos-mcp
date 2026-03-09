import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { getPort, getApiKey, getTransportMode } from "./config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function startTransport(server: McpServer): Promise<void> {
  const mode = getTransportMode();

  if (mode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("STACKOS MCP Server iniciado en modo stdio");
    return;
  }

  // Modo HTTP
  const port = getPort();
  const apiKey = getApiKey();

  const httpServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Health check
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            server: "stackos",
            version: "1.0.0",
          })
        );
        return;
      }

      // Auth check
      if (apiKey) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${apiKey}`) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
      }

      // MCP endpoint
      if (req.url === "/mcp") {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  );

  httpServer.listen(port, () => {
    console.error(
      `STACKOS MCP Server iniciado en modo HTTP — puerto ${port}`
    );
    console.error(`  POST /mcp  → mensajes MCP`);
    console.error(`  GET  /mcp  → SSE stream`);
    console.error(`  GET  /health → health check`);
    if (apiKey) {
      console.error(`  Auth: Bearer token habilitado`);
    }
  });
}
