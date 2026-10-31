import { sendError, sendMessage } from "../utils/sendMessage.js";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleSetReady,
  handleRoomState,
} from "../handlers/roomHandlers.js";
import { handleStartGame, handleCatchPlayer } from "../handlers/gameHandlers.js";
import { handleUpdatePosition, handleGetPositions } from "../lifeCycle/positionHandlers.js";
import {
  handleChangedPose,
  handleRequestState,
  handleUserSetup,
} from "../handlers/playerHandlers.js";

export function handleIncomingMessage(socket, message) {
  let payload;

  try {
    payload = JSON.parse(message.toString());
  } catch {
    sendError(socket, "Invalid JSON", "INVALID_JSON");
    return;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    typeof payload.type !== "string" ||
    typeof payload.data !== "object" ||
    payload.data === null ||
    Array.isArray(payload.data)
  ) {
    sendError(socket, "Invalid message format", "INVALID_MESSAGE_FORMAT");
    return;
  }

  switch (payload.type) {
    case "echo": {
      if (typeof payload.data.message !== "string") {
        sendError(socket, "Echo message must be a string", "INVALID_ECHO");
        return;
      }
      sendMessage(socket, "echo-response", { message: payload.data.message });
      return;
    }
    case "user-setup":
      handleUserSetup(socket, payload);
      return;
    case "create-room":
      handleCreateRoom(socket);
      return;
    case "join-room":
      handleJoinRoom(socket, payload);
      return;
    case "leave-room":
      handleLeaveRoom(socket);
      return;
    case "set-ready":
      handleSetReady(socket, payload);
      return;
    case "start-game":
      handleStartGame(socket);
      return;
    case "catch-player":
    case "mark-caught":
      handleCatchPlayer(socket, payload);
      return;
    case "update-position":
    case "movement":
      handleUpdatePosition(socket, payload);
      return;
    case "get-positions":
    case "get-positons":
      handleGetPositions(socket);
      return;
    case "room-state":
      handleRoomState(socket);
      return;
    case "changed-pose":
      handleChangedPose(socket, payload);
      return;
    case "request-state":
      handleRequestState(socket, payload);
      return;
    default:
      sendError(socket, `Unknown message type: ${payload.type}`, "UNKNOWN_MESSAGE_TYPE");
  }
}