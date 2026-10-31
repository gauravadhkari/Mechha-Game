import { WebSocketServer } from "ws";
import { PORT } from "./config/constants.js";
import { handleConnection } from "./websocket/connection.js";

const wss = new WebSocketServer({ port: PORT });
wss.on("connection", handleConnection);

console.log(`Mecha Chameleon WebSocket server listening on port ${PORT}`);

wss.on("listening", () => {
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
});

wss.on("error", (error) => {
  console.error("WebSocket server error:", error.message);
});