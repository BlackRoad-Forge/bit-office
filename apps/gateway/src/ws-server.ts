import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { CommandSchema } from "@office/shared";
import type { GatewayEvent, Command } from "@office/shared";
import { config } from "./config.js";
import { networkInterfaces } from "os";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import * as Ably from "ably";
import type { Channel } from "./transport.js";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();
let pairCode: string | null = null;
let onCommand: ((cmd: Command) => void) | null = null;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".txt": "text/plain",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

export function setPairCode(code: string) {
  pairCode = code;
}

export const wsChannel: Channel = {
  name: "WebSocket",

  async init(commandHandler: (cmd: Command) => void): Promise<boolean> {
    onCommand = commandHandler;

    return new Promise((resolve) => {
      const requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        // Quick connect — skip pair code for local dev
        if (req.method === "GET" && req.url === "/connect") {
          if (config.ablyApiKey) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Quick connect disabled" }));
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            machineId: config.machineId,
            wsUrl: `ws://localhost:${config.wsPort}`,
          }));
          return;
        }

        if (req.method === "POST" && req.url === "/pair/validate") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const { code } = JSON.parse(body);
              if (!pairCode || code !== pairCode) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid pair code" }));
                return;
              }
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                machineId: config.machineId,
                wsUrl: `ws://localhost:${config.wsPort}`,
                hasAbly: !!config.ablyApiKey,
              }));
            } catch {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Bad request" }));
            }
          });
          return;
        }

        // Ably token endpoint
        if (req.method === "POST" && req.url === "/ably/token") {
          if (!config.ablyApiKey) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Ably not configured" }));
            return;
          }

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              let targetMachineId = config.machineId;
              try {
                const parsed = JSON.parse(body);
                if (parsed.machineId) targetMachineId = parsed.machineId;
              } catch {
                // no body, use config default
              }

              if (!targetMachineId) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "No machine ID" }));
                return;
              }

              const rest = new Ably.Rest({ key: config.ablyApiKey });
              const tokenRequest = await rest.auth.createTokenRequest({
                clientId: `device:${Date.now()}`,
                ttl: 5 * 60 * 1000,
                capability: {
                  [`machine:${targetMachineId}:commands`]: ["publish"],
                  [`machine:${targetMachineId}:events`]: ["subscribe"],
                },
              });

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(tokenRequest));
            } catch (err) {
              console.error("[WS] Ably token error:", err);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Token creation failed" }));
            }
          });
          return;
        }

        // --- Static file serving (fallback, production only) ---
        if (process.env.NODE_ENV === "development") {
          res.writeHead(404);
          res.end("Not Found (dev mode — use Next.js dev server)");
          return;
        }
        await serveStatic(req, res);
      };

      const maxRetries = 10;
      let port = config.wsPort;

      const tryListen = () => {
        const httpServer = createServer(requestHandler);
        httpServer.listen(port, () => {
          config.wsPort = port;

          // Attach WebSocket server only after successful listen
          wss = new WebSocketServer({ server: httpServer });
          wss.on("connection", (ws) => {
            clients.add(ws);
            console.log(`[WS] Client connected (total: ${clients.size})`);

            ws.on("message", (data) => {
              try {
                const parsed = CommandSchema.parse(JSON.parse(data.toString()));
                onCommand?.(parsed);
              } catch (err) {
                console.error("[WS] Invalid command:", err);
              }
            });

            ws.on("close", () => {
              clients.delete(ws);
              console.log(`[WS] Client disconnected (total: ${clients.size})`);
            });
          });

          console.log(`[WS] Server listening on port ${port}`);
          printLanAddresses();
          resolve(true);
        });

        httpServer.once("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE" && port - config.wsPort < maxRetries) {
            const oldPort = port;
            port++;
            console.log(`[WS] Port ${oldPort} in use, trying ${port}...`);
            tryListen();
          } else {
            console.error(`[WS] Failed to start server:`, err.message);
            resolve(false);
          }
        });
      };

      tryListen();
    });
  },

  broadcast(event: GatewayEvent) {
    const data = JSON.stringify(event);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  },

  destroy() {
    for (const ws of clients) {
      ws.close();
    }
    clients.clear();
    wss?.close();
    wss = null;
  },
};

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = decodeURIComponent(req.url?.split("?")[0] ?? "/");

  const routeMap: Record<string, string> = {
    "/": "/index.html",
    "/pair": "/pair.html",
    "/office": "/office.html",
  };

  let filePath: string;
  if (routeMap[url]) {
    filePath = join(config.webDir, routeMap[url]);
  } else {
    filePath = join(config.webDir, url);
  }

  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    const content = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    try {
      const htmlPath = filePath + ".html";
      const content = await readFile(htmlPath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }
}

function printLanAddresses() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        console.log(`[WS] LAN: http://${net.address}:${config.wsPort}`);
      }
    }
  }
}
