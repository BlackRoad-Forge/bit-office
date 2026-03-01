import * as Ably from "ably";
import { config } from "./config.js";
import { CommandSchema } from "@office/shared";
import type { GatewayEvent, Command } from "@office/shared";
import type { Channel } from "./transport.js";

let client: Ably.Realtime | null = null;
let eventsChannel: Ably.RealtimeChannel | null = null;

export const ablyChannel: Channel = {
  name: "Ably",

  async init(commandHandler: (cmd: Command) => void): Promise<boolean> {
    if (!config.ablyApiKey) return false;

    client = new Ably.Realtime({ key: config.ablyApiKey });
    await client.connection.once("connected");
    console.log("[Ably] Connected");

    eventsChannel = client.channels.get(`machine:${config.machineId}:events`);
    const commandsChannel = client.channels.get(`machine:${config.machineId}:commands`);

    await commandsChannel.subscribe((msg: Ably.Message) => {
      try {
        const parsed = CommandSchema.parse(msg.data);
        commandHandler(parsed);
      } catch (err) {
        console.error("[Ably] Invalid command:", err);
      }
    });

    return true;
  },

  broadcast(event: GatewayEvent) {
    if (!eventsChannel) return;
    eventsChannel.publish(event.type, event);
  },

  destroy() {
    client?.close();
    client = null;
    eventsChannel = null;
  },
};
