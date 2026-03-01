const CONNECTION_KEY = "office_connection";

export interface ConnectionInfo {
  mode: "ws" | "ably";
  machineId: string;
  wsUrl?: string;
}

export function saveConnection(info: ConnectionInfo) {
  localStorage.setItem(CONNECTION_KEY, JSON.stringify(info));
}

export function getConnection(): ConnectionInfo | null {
  const raw = localStorage.getItem(CONNECTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConnectionInfo;
  } catch {
    return null;
  }
}

export function clearConnection() {
  localStorage.removeItem(CONNECTION_KEY);
}

/** Derive Gateway HTTP URL from stored wsUrl (ws://host:port → http://host:port) or use current origin */
export function getGatewayHttpUrl(): string {
  const conn = getConnection();
  if (conn?.wsUrl) {
    return conn.wsUrl.replace(/^ws(s?):\/\//, "http$1://");
  }
  return window.location.origin;
}
