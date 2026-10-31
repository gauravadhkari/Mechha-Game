import { randomUUID } from "node:crypto";
import {
  playerToSocket,
  socketToPlayer,
  playerToRoom,
  playerStates,
  playerPositions,
  createPlayerState,
} from "../state/store.js";
import { sendMessage } from "../utils/sendMessage.js";
import { handleIncomingMessage } from "./messageRouter.js";
import { removePlayerFromRoom } from "../lifecycle/playerRemoval.js";

export function handleConnection(socket) {
  const playerId = randomUUID();

  playerToSocket.set(playerId, socket);
  socketToPlayer.set(socket, playerId);
  playerStates.set(playerId, createPlayerState(playerId));

  console.log("Player connected:", playerId);
  sendMessage(socket, "connected", { playerId });

  socket.on("message", (message) => {
    handleIncomingMessage(socket, message);
  });

  socket.on("close", () => handleDisconnect(socket));
  socket.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });
}

function handleDisconnect(socket) {
  const playerId = socketToPlayer.get(socket);
  if (!playerId) return;

  console.log("Player disconnected:", playerId);

  if (playerToRoom.has(playerId)) {
    removePlayerFromRoom(playerId, "player-disconnected");
  }

  playerToRoom.delete(playerId);
  playerPositions.delete(playerId);
  playerStates.delete(playerId);
  playerToSocket.delete(playerId);
  socketToPlayer.delete(socket);
}
