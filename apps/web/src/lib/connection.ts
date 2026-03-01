import type { ConnectionInfo } from "./storage";
import { connectToAbly, sendCommand as ablySend, disconnectAbly } from "./ably-client";
import { connectToWs, sendWsCommand, disconnectWs } from "./ws-client";

let activeMode: "ws" | "ably" | null = null;

export function connect(info: ConnectionInfo) {
  disconnect();

  if (info.mode === "ws" && info.wsUrl) {
    activeMode = "ws";
    connectToWs(info.wsUrl);
  } else if (info.mode === "ably") {
    activeMode = "ably";
    connectToAbly(info.machineId);
  }
}

export function sendCommand(command: Record<string, unknown>) {
  if (activeMode === "ws") {
    sendWsCommand(command);
  } else if (activeMode === "ably") {
    ablySend(command);
  } else {
    console.error("[Connection] No active transport");
  }
}

export function disconnect() {
  if (activeMode === "ws") {
    disconnectWs();
  } else if (activeMode === "ably") {
    disconnectAbly();
  }
  activeMode = null;
}
