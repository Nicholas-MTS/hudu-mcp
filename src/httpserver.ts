import http from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools/index.js";
import { HuduClient } from "./hudu-client.js";

const PORT = parseInt(process.env.PORT ?? "8080", 10);

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

if (!HUDU_API_KEY || !HUDU_BASE_URL) {
  console.error("ERROR: HUDU_API_KEY and HUDU_BASE_URL are required");
  process.exit(1);
}

function buildServer(): Server {
  const huduClient = new HuduClient(HUDU_BASE_URL!, HUDU_API_KEY!);
  const server = new Server(
    { name: "hudu-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  registerTools(server, huduClient);
  return server;
}

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url === "/mcp") {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => { transport.close().catch(() => {}); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.error(`Hudu MCP listening on port ${PORT}`);
});

httpServer.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
