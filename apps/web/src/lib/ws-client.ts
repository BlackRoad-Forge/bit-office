import { GatewayEventSchema } from "@office/shared";
import { useOfficeStore } from "@/store/office-store";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentUrl: string | null = null;

export function connectToWs(wsUrl: string) {
  // Clean up any existing connection first
  cleanup();
  currentUrl = wsUrl;
  doConnect();
}

function cleanup() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    // Remove handlers so close event doesn't trigger reconnect
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }
}

function doConnect() {
  if (!currentUrl) return;

  const socket = new WebSocket(currentUrl);

  socket.onopen = () => {
    console.log("[WS] Connected");
    useOfficeStore.getState().setConnected(true);
    // Send PING to get current agent statuses
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
    }
  };

  socket.onmessage = (evt) => {
    try {
      const event = GatewayEventSchema.parse(JSON.parse(evt.data));
      useOfficeStore.getState().handleEvent(event);
    } catch (err) {
      console.error("[WS] Invalid event:", err);
    }
  };

  socket.onclose = () => {
    console.log("[WS] Disconnected");
    useOfficeStore.getState().setConnected(false);
    // Only reconnect if this is still the active socket
    if (ws === socket && currentUrl) {
      ws = null;
      reconnectTimer = setTimeout(doConnect, 2000);
    }
  };

  socket.onerror = () => {
    // Error is always followed by close, so just let onclose handle reconnect
  };

  ws = socket;
}

export function sendWsCommand(command: Record<string, unknown>) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[WS] Not connected, dropping command:", command.type);
    return;
  }
  console.log("[WS] Sending command:", command.type, command);
  ws.send(JSON.stringify(command));
}

export function disconnectWs() {
  currentUrl = null;
  cleanup();
}
