import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

type Session = {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  cdpPort: number;
  chrome: ReturnType<typeof Bun.spawn>;
  client: Client;
  transport: StdioClientTransport;
};

const MCP_PORT = Number(process.env.MCP_PORT ?? 3000);
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS ?? 4);
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 30 * 60 * 1000);
const DISPLAY = process.env.DISPLAY ?? ":99";
const SESSION_ROOT = process.env.SESSION_ROOT ?? "/data/sessions";
const CHROME_BIN = process.env.CHROME_BIN ?? "google-chrome";
const MCP_PACKAGE = `${process.cwd()}/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`;
const sessions = new Map<string, Session>();
const transports = new Map<string, StreamableHTTPServerTransport>();
let nextCdpPort = 9223;

const managementTools = [
  {
    name: "create_session",
    description: "Create an isolated Chrome session and return its UUID.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "destroy_session",
    description: "Destroy an isolated Chrome session and its browser process.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"], additionalProperties: false },
  },
  {
    name: "list_sessions",
    description: "List isolated Chrome sessions owned by this gateway.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "session_status",
    description: "Read the status and timestamps of one isolated Chrome session.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"], additionalProperties: false },
  },
  {
    name: "chrome_call",
    description: "Call any Chrome DevTools MCP tool. Every call requires session_id and passes the remaining arguments to the selected Chrome tool.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "UUID returned by create_session" },
        tool: { type: "string", description: "Chrome DevTools MCP tool name, for example list_pages or navigate_page" },
        arguments: { type: "object", additionalProperties: true },
      },
      required: ["session_id", "tool"],
      additionalProperties: false,
    },
  },
];

async function waitForChrome(port: number) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {}
    await Bun.sleep(500);
  }
  throw new Error(`Chrome CDP did not become ready on port ${port}`);
}

async function createSession(): Promise<Session> {
  if (sessions.size >= MAX_SESSIONS) {
    throw new McpError(ErrorCode.InvalidRequest, `Maximum session limit reached (${MAX_SESSIONS})`);
  }
  const id = randomUUID();
  const cdpPort = nextCdpPort++;
  const profile = `${SESSION_ROOT}/${id}/chrome`;
  const chrome = Bun.spawn([
    CHROME_BIN,
    `--display=${DISPLAY}`,
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--start-maximized",
    "about:blank",
  ], { stdout: "ignore", stderr: "ignore" });
  await waitForChrome(cdpPort);

  const transport = new StdioClientTransport({
    command: "node",
    args: [MCP_PACKAGE, `--browserUrl=http://127.0.0.1:${cdpPort}`],
    stderr: "ignore",
  });
  const client = new Client({ name: "google-chrome-mcp-gateway", version: "1.0.0" });
  await client.connect(transport);
  const now = Date.now();
  const session = { id, createdAt: now, lastUsedAt: now, cdpPort, chrome, client, transport };
  sessions.set(id, session);
  return session;
}

async function destroySession(id: string) {
  const session = sessions.get(id);
  if (!session) return false;
  sessions.delete(id);
  await session.client.close().catch(() => {});
  session.chrome.kill();
  return true;
}

function getSession(id: unknown): Session {
  if (typeof id !== "string" || !sessions.has(id)) {
    throw new McpError(ErrorCode.InvalidParams, "Unknown or missing session_id");
  }
  const session = sessions.get(id)!;
  session.lastUsedAt = Date.now();
  return session;
}

function gatewayServer() {
  const server = new Server(
    { name: "google-chrome-mcp-gateway", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: managementTools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};
    switch (request.params.name) {
      case "create_session": {
        const session = await createSession();
        return { content: [{ type: "text", text: JSON.stringify({ session_id: session.id, status: "ready" }) }] };
      }
      case "destroy_session": {
        const destroyed = await destroySession(args.session_id);
        return { content: [{ type: "text", text: JSON.stringify({ session_id: args.session_id, destroyed }) }] };
      }
      case "list_sessions":
        return { content: [{ type: "text", text: JSON.stringify([...sessions.values()].map(session => ({ session_id: session.id, cdp_port: session.cdpPort, created_at: session.createdAt, last_used_at: session.lastUsedAt }))) }] };
      case "session_status": {
        const session = getSession(args.session_id);
        return { content: [{ type: "text", text: JSON.stringify({ session_id: session.id, status: "ready", cdp_port: session.cdpPort, created_at: session.createdAt, last_used_at: session.lastUsedAt }) }] };
      }
      case "chrome_call": {
        const session = getSession(args.session_id);
        if (typeof args.tool !== "string" || args.tool === "chrome_call") throw new McpError(ErrorCode.InvalidParams, "tool must be a Chrome DevTools MCP tool name");
        return await session.client.callTool({ name: args.tool, arguments: (args.arguments as Record<string, unknown>) ?? {} });
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown gateway tool: ${request.params.name}`);
    }
  });
  return server;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const httpServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  if (request.url !== "/mcp") { response.writeHead(404).end("Not found"); return; }
  try {
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;
    if (request.method === "POST" && !transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: id => transports.set(id, transport!),
        onsessionclosed: id => transports.delete(id),
      });
      const server = gatewayServer();
      await server.connect(transport);
    }
    if (!transport) { response.writeHead(400).end("Missing MCP session"); return; }
    await transport.handleRequest(request, response, await readBody(request));
  } catch (error) {
    if (!response.headersSent) response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});

const cleanupInterval = Math.min(10_000, Math.max(1_000, Math.floor(SESSION_TTL_MS / 2)));
setInterval(() => {
  for (const [id, session] of sessions) {
    if (Date.now() - session.lastUsedAt > SESSION_TTL_MS) destroySession(id).catch(() => {});
  }
}, cleanupInterval).unref();

httpServer.listen(MCP_PORT, "0.0.0.0", () => console.error(`Chrome MCP gateway listening on ${MCP_PORT}`));

