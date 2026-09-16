import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const baseUrl = process.env.MCP_BASE_URL ?? "http://127.0.0.1:3000/mcp";
const client = new Client({ name: "multi-session-test", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
await client.connect(transport);

const text = (result: any) => result.content?.find((item: any) => item.type === "text")?.text ?? "";
const create = async () => JSON.parse(text(await client.callTool({ name: "create_session", arguments: {} })));
const first = await create();
const second = await create();
if (first.session_id === second.session_id) throw new Error("Session IDs are not unique");

const pages = async (session_id: string) => text(await client.callTool({ name: "list_pages", arguments: { session_id } }));
const firstBefore = await pages(first.session_id);
const secondBefore = await pages(second.session_id);
if (!firstBefore.includes("about:blank") || !secondBefore.includes("about:blank")) throw new Error("Initial pages are missing");

await client.callTool({ name: "new_page", arguments: { session_id: first.session_id, url: "data:text/html,<title>Session One</title>" } });
const firstAfter = await pages(first.session_id);
const secondAfter = await pages(second.session_id);
if (!firstAfter.includes("Session One")) throw new Error("First session did not create its page");
if (secondAfter.includes("Session One")) throw new Error("Chrome profiles are not isolated");

await client.callTool({ name: "destroy_session", arguments: { session_id: first.session_id } });
await client.callTool({ name: "destroy_session", arguments: { session_id: second.session_id } });
await transport.close();
console.log("Multi-session tests passed");

