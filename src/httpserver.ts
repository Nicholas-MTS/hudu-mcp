import http from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools/index.js";
import { HuduClient } from "./hudu-client.js";
 
const PORT = parseInt(process.env.PORT ?? "8080", 10);
 
// Validate required env vars at startup
const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;
 
if (!HUDU_API_KEY || !HUDU_BASE_URL) {
  console.error("ERROR: HUDU_API_KEY and HUDU_BASE_URL environment variables are required");
  process.exit(1);
}
 
// Factory — creates a fresh McpServer + registered tools per request.
// StreamableHTTPServerTransport is stateless, so we must not reuse a
// single McpServer instance across requests (throws "Already connected").
function buildServer(): McpServer {
  const huduClient = new HuduClient(HUDU_BASE_URL!, HUDU_API_KEY!);
  const server = new McpServer({
    name: "hudu-mcp",
    version: "1.0.0",
  });
  registerTools(server, huduClient);
  return server;
}
 
const httpServer = http.createServer(async (req, res) => {
  // Health check — used by Azure Container Apps
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", transport: "streamable-http" }));
    return;
  }
 
  // MCP endpoint — Claude.ai connectors page connects here
  if (req.url === "/mcp") {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });
 
    res.on("close", () => {
      transport.close().catch(() => {});
    });
 
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }
 
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});
 
httpServer.listen(PORT, "0.0.0.0", () => {
  console.error(`Hudu MCP server listening on port ${PORT}`);
  console.error(`MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.error(`Health check: http://0.0.0.0:${PORT}/health`);
});
 
httpServer.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
