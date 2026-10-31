 import { rooms, playerToSocket } from "../state/store.js";
export function sendMessage(socket, type, data = {}) {
  if (!socket || socket.readyState !== 1) return false;

  socket.send(JSON.stringify({ type, data }));
  return true;
}

export function sendError(socket, message, code = "BAD_REQUEST") {
  return sendMessage(socket, "error", { code, message });
}

export function sendToRoom(roomId, type, data = {}, excludedPlayerId = null) {
  const roomMembers = rooms.get(roomId);
  if (!roomMembers) return 0;

  let sent = 0;
  for (const memberId of roomMembers) {
    if (memberId === excludedPlayerId) continue;
    const memberSocket = playerToSocket.get(memberId);
    if (sendMessage(memberSocket, type, data)) sent += 1;
  }
  return sent;
}

 