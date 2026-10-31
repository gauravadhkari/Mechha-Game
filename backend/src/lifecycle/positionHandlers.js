import {
  socketToPlayer,
  playerToRoom,
  rooms,
  roomState,
  playerPositions,
  playerStates,
} from "../state/store.js";
import { sendError, sendMessage, sendToRoom } from "../utils/sendMessage.js";

export function handleUpdatePosition(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);
  if (!playerId || !roomId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");

  const roomMembers = rooms.get(roomId);
  if (!roomMembers?.has(playerId)) return;
  if (roomState.get(roomId) !== "playing") {
    return sendError(socket, "Player movement is only accepted during a game", "GAME_NOT_RUNNING");
  }

  // Supports both the current format { data: { x, y, z } } and the friend's
  // format { data: { coordinates: { x, y, z, ry, col } } }.
  const data = payload.data ?? {};
  const coordinates = data.coordinates ?? data.position ?? data;
  const { x, y, z } = coordinates;

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return sendError(socket, "Position x, y, and z must be finite numbers", "INVALID_POSITION");
  }

  const state = playerStates.get(playerId);
  const rotationValue = coordinates.ry ?? coordinates.rotation ?? data.rotation;
  if (rotationValue !== undefined && !Number.isFinite(rotationValue)) {
    return sendError(socket, "Rotation must be a finite number", "INVALID_ROTATION");
  }

  const colorValue = coordinates.col ?? coordinates.color ?? data.color;
  if (colorValue !== undefined && colorValue !== null &&
      (typeof colorValue !== "string" || colorValue.length > 32)) {
    return sendError(socket, "Color must be a short string or null", "INVALID_COLOR");
  }

  const poseValue = data.pose ?? coordinates.pose;
  if (poseValue !== undefined &&
      (typeof poseValue !== "string" || poseValue.trim() === "" || poseValue.length > 40)) {
    return sendError(socket, "Pose must be a non-empty short string", "INVALID_POSE");
  }

  const position = { x, y, z };
  if (state) {
    state.position = position;
    if (rotationValue !== undefined) state.rotation = rotationValue;
    if (colorValue !== undefined) state.color = colorValue;
    if (poseValue !== undefined) state.pose = poseValue;
  }

  const savedState = {
    x,
    y,
    z,
    rotation: state?.rotation ?? 0,
    color: state?.color ?? null,
    pose: state?.pose ?? "Stand",
  };
  playerPositions.set(playerId, savedState);

  sendToRoom(roomId, "position-updated", {
    playerId,
    ...savedState,
  }, playerId);
}

export function handleGetPositions(socket) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!playerId || !roomId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");

  const roomMembers = rooms.get(roomId);
  if (!roomMembers?.has(playerId)) {
    return sendError(socket, "Room membership was not found", "ROOM_MEMBERSHIP_NOT_FOUND");
  }
  if (roomState.get(roomId) !== "playing") {
    return sendError(socket, "The game is not running", "GAME_NOT_RUNNING");
  }

  const positions = [];
  for (const memberId of roomMembers) {
    const position = playerPositions.get(memberId);
    if (!position) continue;

    positions.push({
      playerId: memberId,
      ...position,
    });
  }

  sendMessage(socket, "room-positions", { roomId, positions });
}