import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { getPort, getApiKey, getTransportMode } from "./config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getYoSupabase } from "./utils/yo-supabase.js";
import { resolveProjectSlug } from "./yo/projects-resolver.js";
import { buildFullBrief } from "./yo/brief.js";
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

      // /yo/brief — briefing denso para hook SessionStart.
      // format=md → markdown 5-8 líneas | format=json → objeto completo.
      // Slug resuelto por repo_basename desde yo.projects.
      if (req.url?.startsWith("/yo/brief")) {
        try {
          const parsedUrl = new URL(req.url, `http://localhost:${port}`);
          const projectHint = parsedUrl.searchParams.get("project") ?? "";
          const limitRaw = parsedUrl.searchParams.get("limit");
          const limit = limitRaw ? Math.min(20, parseInt(limitRaw, 10)) : 5;
          const format = parsedUrl.searchParams.get("format") ?? "json";

          const supa = getYoSupabase();
          const slug = await resolveProjectSlug(projectHint, supa);

          if (!slug) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ project: null, count: 0, tasks: [], markdown: "" }));
            return;
          }

          const { markdown, data } = await buildFullBrief(supa, slug, limit);

          if (format === "md") {
            res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
            res.end(markdown);
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              project: slug,
              count: data.tasks.length,
              tasks: data.tasks,
              blockers: data.blockers,
              recent_wa: data.recent_wa,
              memory_excerpt: data.memory_excerpt,
              markdown,
            }));
          }
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: (err as Error).message }));
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
