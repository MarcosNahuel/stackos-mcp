import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { getPort, getApiKey, getTransportMode } from "./config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { yoListTasks } from "./tools/yo-list-tasks.js";
import { validateBearer, logAuthAttempt, loadTokens } from "./auth.js";

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

      // Auth check (multi-token con scopes — STACKOS_TOKENS_FILE).
      // Compat: STACKOS_API_KEY se registra como legacy con scope *.
      const tokens = loadTokens();
      const authNeeded = tokens.tokens.length > 0;
      // Resolver scope requerido por endpoint
      let requiredScope = "mcp:invoke";
      if (req.url?.startsWith("/yo/brief")) requiredScope = "tasks:read";
      else if (req.url === "/mcp") requiredScope = "mcp:invoke";

      const ip =
        (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ??
        req.socket.remoteAddress;

      if (authNeeded) {
        const auth = validateBearer(
          req.headers.authorization,
          requiredScope
        );
        await logAuthAttempt(auth, requiredScope, req.url ?? "?", ip);
        if (!auth.ok) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Unauthorized",
              reason: auth.reason,
            })
          );
          return;
        }
      }

      // /yo/brief — endpoint dedicado para hook SessionStart (FIX M5).
      // El service_role queda SOLO server-side; el hook usa Bearer scope tasks:read.
      if (req.url?.startsWith("/yo/brief")) {
        try {
          const url = new URL(req.url, `http://localhost:${port}`);
          const project = url.searchParams.get("project") ?? undefined;
          const limitRaw = url.searchParams.get("limit");
          const limit = limitRaw ? Math.min(20, parseInt(limitRaw, 10)) : 5;
          const tasks = await yoListTasks({
            project,
            status: "pending",
            limit,
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ project, count: tasks.length, tasks }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: (err as Error).message })
          );
        }
        return;
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
