import { randomUUID } from "node:crypto";
import {
  playerToRoom,
  socketToPlayer,
  rooms,
  roomHosts,
  readyPlayers,
  roomState,
  playerStates,
  clearRoomData,
} from "../state/store.js";
import { sendError, sendMessage, sendToRoom } from "../utils/sendMessage.js";
import { removePlayerFromRoom } from "../lifecycle/playerRemoval.js";

export function handleCreateRoom(socket) {
  const playerId = socketToPlayer.get(socket);
  if (!playerId) return sendError(socket, "Player not found", "PLAYER_NOT_FOUND");

  if (playerToRoom.has(playerId)) {
    return sendError(socket, "You are already in a room", "ALREADY_IN_ROOM");
  }

  const roomId = randomUUID();
  rooms.set(roomId, new Set([playerId]));
  readyPlayers.set(roomId, new Set());
  roomHosts.set(roomId, playerId);
  playerToRoom.set(playerId, roomId);
  roomState.set(roomId, "lobby");

  const playerState = playerStates.get(playerId);
  if (playerState) playerState.roomId = roomId;

  sendMessage(socket, "room-created", { roomId, hostId: playerId });
}

export function handleJoinRoom(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const roomId = payload.data.roomId;

  if (!playerId) return sendError(socket, "Player not found", "PLAYER_NOT_FOUND");
  if (typeof roomId !== "string" || roomId.trim() === "") {
    return sendError(socket, "Invalid room ID", "INVALID_ROOM_ID");
  }
  if (playerToRoom.has(playerId)) {
    return sendError(socket, "You are already in a room", "ALREADY_IN_ROOM");
  }

  const roomMembers = rooms.get(roomId);
  if (!roomMembers) return sendError(socket, "Room not found", "ROOM_NOT_FOUND");
  if (roomState.get(roomId) !== "lobby") {
    return sendError(socket, "Cannot join a room while a game is running", "GAME_IN_PROGRESS");
  }

  roomMembers.add(playerId);
  playerToRoom.set(playerId, roomId);
  const playerState = playerStates.get(playerId);
  if (playerState) playerState.roomId = roomId;

  sendToRoom(roomId, "player-joined", {
    playerId,
    displayName: playerState?.displayName ?? null,
  }, playerId);
  sendMessage(socket, "room-joined", { roomId, hostId: roomHosts.get(roomId) });
}

export function handleLeaveRoom(socket) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!playerId || !roomId) {
    return sendError(socket, "You are not in a room", "NOT_IN_ROOM");
  }

  removePlayerFromRoom(playerId, "player-left");
  sendMessage(socket, "room-left", { playerId, roomId });
}

export function handleSetReady(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!playerId || !roomId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");
  if (typeof payload.data?.ready !== "boolean") {
    return sendError(socket, "Ready must be true or false", "INVALID_READY_VALUE");
  }

  const readyState = readyPlayers.get(roomId);
  const roomMembers = rooms.get(roomId);
  if (!readyState || !roomMembers || !roomMembers.has(playerId)) {
    return sendError(socket, "Room membership was not found", "ROOM_MEMBERSHIP_NOT_FOUND");
  }
  if (roomState.get(roomId) !== "lobby") {
    return sendError(socket, "You cannot change readiness after the game starts", "GAME_IN_PROGRESS");
  }

  const ready = payload.data.ready;
  if (ready) readyState.add(playerId);
  else readyState.delete(playerId);

  sendToRoom(roomId, "player-ready-changed", { playerId, ready });

  const members = [...roomMembers];
  const readyCount = members.filter((memberId) => readyState.has(memberId)).length;
  const allReady = members.length > 0 && readyCount === members.length;

  sendToRoom(roomId, "lobby-status", {
    readyCount,
    totalPlayers: members.length,
    allReady,
  });
}

export function handleRoomState(socket) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!playerId || !roomId) {
    return sendError(socket, "Player or room not found", "NOT_IN_ROOM");
  }

  const roomMembers = rooms.get(roomId);
  if (!roomMembers?.has(playerId)) {
    return sendError(socket, "Room membership was not found", "ROOM_MEMBERSHIP_NOT_FOUND");
  }

  const state = roomState.get(roomId);
  if (state !== "lobby") {
    return sendError(socket, "Room state is not in the lobby", "NOT_IN_LOBBY");
  }

  const hostId = roomHosts.get(roomId);
  const readyState = readyPlayers.get(roomId) ?? new Set();
  const members = [...roomMembers].map((memberId) => ({
    playerId: memberId,
    displayName: playerStates.get(memberId)?.displayName ?? null,
    ready: readyState.has(memberId),
  }));

  sendMessage(socket, "room-state", {
    roomId,
    hostId,
    totalMembers: roomMembers.size,
    state,
    members,
  });
}