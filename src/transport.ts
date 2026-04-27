import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { URL } from "url";
import { getPort, getApiKey, getTransportMode, getWebhookToken, isWebhookAuthRequired } from "./config.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getYoSupabase } from "./utils/yo-supabase.js";
import { resolveProjectSlug } from "./yo/projects-resolver.js";
import { buildFullBrief } from "./yo/brief.js";
import { classifyMessage } from "./yo/classifier.js";
import { validateBearer, logAuthAttempt, loadTokens } from "./auth.js";
import { getTasksHandler } from "./yo/http-tasks.js";
import { sessionCloseHandler } from "./yo/session-close.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveProjectForContact(supa: any, contactId: string): Promise<string | null> {
  const { data } = await supa
    .from("contact_projects")
    .select("project_slug")
    .or(`contact_id.eq.${contactId}`)
    .limit(1)
    .maybeSingle();
  return (data as { project_slug: string } | null)?.project_slug ?? null;
}

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

  // Supabase client para endpoints yo/*
  const supa = getYoSupabase();
  const tasksHandler = getTasksHandler(supa);
  const CN_PATH = process.env.CN_PATH || '/data';
  const sessionCloseHandlerInstance = sessionCloseHandler(supa, CN_PATH);

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
      else if (req.url?.split("?")[0] === "/yo/tasks") requiredScope = "tasks:read";
      else if (req.url?.split("?")[0] === "/yo/session-close") requiredScope = "tasks:read";
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

      // GET /yo/tasks — lista tareas abiertas (para Stop hook)
      if (req.method === "GET" && req.url?.split("?")[0] === "/yo/tasks") {
        const parsed = new URL(req.url, `http://localhost:${port}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fakeReq = { query: Object.fromEntries(parsed.searchParams.entries()) } as any;
        const fakeRes = {
          _status: 200,
          status(code: number) { this._status = code; return this; },
          json(body: unknown) {
            res.writeHead(this._status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(body));
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
        await tasksHandler(fakeReq, fakeRes);
        return;
      }

      // POST /yo/session-close — marca tasks resueltos + genera draft
      if (req.method === "POST" && req.url?.split("?")[0] === "/yo/session-close") {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fakeReq = { body: parsed } as any;
            const fakeRes = {
              _status: 200,
              status(code: number) { this._status = code; return this; },
              json(responseBody: unknown) {
                res.writeHead(this._status, { "Content-Type": "application/json" });
                res.end(JSON.stringify(responseBody));
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any;
            await sessionCloseHandlerInstance(fakeReq, fakeRes);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          }
        });
        return;
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

          const briefSupa = getYoSupabase();
          const slug = await resolveProjectSlug(projectHint, briefSupa);

          if (!slug) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ project: null, count: 0, tasks: [], markdown: "" }));
            return;
          }

          const { markdown, data } = await buildFullBrief(briefSupa, slug, limit);

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

      // Webhook endpoint — recibe mensajes WA desde n8n
      // Auth separada del sistema Bearer: usa X-Webhook-Token
      if (req.url === "/yo/webhook" && req.method === "POST") {
        if (isWebhookAuthRequired()) {
          const expected = getWebhookToken();
          const provided = req.headers["x-webhook-token"] as string | undefined;
          if (!expected || provided !== expected) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized", reason: "invalid_webhook_token" }));
            return;
          }
        }

        let body = "";
        for await (const chunk of req) body += chunk;

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body) as Record<string, unknown>;
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        const text = (payload.text ?? payload.message ?? payload.body ?? "") as string;
        const contactId = (payload.contact_id ?? payload.from ?? null) as string | null;
        const projectSlug = (payload.project_slug ?? null) as string | null;

        try {
          const webhookSupa = getYoSupabase();

          // Check contact muted status
          let muted = false;
          if (contactId) {
            const { data: contact } = await webhookSupa
              .from("contacts")
              .select("muted, is_personal")
              .or(`id.eq.${contactId},whatsapp_number.eq.${contactId}`)
              .maybeSingle();
            muted = !!(contact?.muted || contact?.is_personal);
          }

          // Classify
          const classification = await classifyMessage(text);

          // Determine project for task
          const resolvedSlug = projectSlug ?? (contactId
            ? await resolveProjectForContact(webhookSupa, contactId)
            : null) ?? "sistema-yo";

          // Insert task (always, unless muted)
          let taskId: string | null = null;
          if (!muted) {
            const { data: task } = await webhookSupa
              .from("tasks")
              .insert({
                project_slug: resolvedSlug,
                content_md: text.slice(0, 4000),
                source: "whatsapp",
                priority: classification.label === "urgent_task" && classification.confidence > 0.8
                  ? "urgent"
                  : "medium",
                classification_confidence: classification.confidence,
                task_type: classification.label,
                metadata: { from: contactId, classifier: classification.model },
              })
              .select("id")
              .single();
            taskId = task?.id ?? null;
          }

          // Save to classification_audit
          await webhookSupa.from("classification_audit").insert({
            task_id: taskId,
            contact_id: contactId && !contactId.includes("+")
              ? contactId
              : null,
            source: "webhook",
            input_excerpt: text.slice(0, 500),
            candidates: classification.candidates,
            model: classification.model,
            decision_slug: classification.label,
            confidence: classification.confidence,
            fallback_used: classification.fallback_used,
            latency_ms: classification.latency_ms,
            error: classification.error,
          });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ok: true,
            muted,
            task_id: taskId,
            classification: {
              label: classification.label,
              confidence: classification.confidence,
              model: classification.model,
            },
          }));
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
    console.error(`  GET  /yo/tasks → lista tareas abiertas`);
    console.error(`  POST /yo/session-close → cierra sesion + draft`);
    console.error(`  GET  /yo/brief → briefing SessionStart`);
    console.error(`  POST /yo/webhook → mensajes WhatsApp`);
    if (apiKey) {
      console.error(`  Auth: Bearer token habilitado`);
    }
  });
}
