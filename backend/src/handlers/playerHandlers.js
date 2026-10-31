import {
  socketToPlayer,
  playerToRoom,
  rooms,
  roomHosts,
  readyPlayers,
  roomState,
  gameData,
  playerStates,
  playerPositions,
} from "../state/store.js";
import { sendError, sendMessage, sendToRoom } from "../utils/sendMessage.js";

export function handleUserSetup(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const state = playerStates.get(playerId);
  if (!playerId || !state) return sendError(socket, "Player not found", "PLAYER_NOT_FOUND");

  const requestedName = payload.data?.userName ?? payload.data?.displayName;
  if (typeof requestedName !== "string" || requestedName.trim() === "" || requestedName.trim().length > 32) {
    return sendError(socket, "userName must be between 1 and 32 characters", "INVALID_DISPLAY_NAME");
  }

  // A name is a display label only. The server-generated playerId remains the
  // identity used for rooms, roles, catches, and authorization.
  state.displayName = requestedName.trim();
  sendMessage(socket, "user-setup-complete", {
    playerId,
    displayName: state.displayName,
  });
}

export function handleChangedPose(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);
  const pose = payload.data?.pose;

  if (!playerId || !roomId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");
  if (typeof pose !== "string" || pose.trim() === "" || pose.length > 40) {
    return sendError(socket, "Pose must be a non-empty short string", "INVALID_POSE");
  }

  const state = playerStates.get(playerId);
  if (state) state.pose = pose;
  const position = playerPositions.get(playerId);
  if (position) position.pose = pose;

  sendToRoom(roomId, "pose-changed", {
    playerId,
    displayName: state?.displayName ?? null,
    pose,
  });
}

export function handleRequestState(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!playerId || !roomId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");
  if (payload.data?.roomId && payload.data.roomId !== roomId) {
    return sendError(socket, "You cannot request state for another room", "ROOM_ACCESS_DENIED");
  }

  const roomMembers = rooms.get(roomId);
  if (!roomMembers?.has(playerId)) {
    return sendError(socket, "Room membership was not found", "ROOM_MEMBERSHIP_NOT_FOUND");
  }

  const readyState = readyPlayers.get(roomId) ?? new Set();
  const members = [...roomMembers].map((memberId) => ({
    playerId: memberId,
    displayName: playerStates.get(memberId)?.displayName ?? null,
    ready: readyState.has(memberId),
  }));

  const players = [...roomMembers].map((memberId) => {
    const state = playerStates.get(memberId);
    const position = playerPositions.get(memberId) ?? state?.position ?? { x: 0, y: 0, z: 0 };

    return {
      playerId: memberId,
      displayName: state?.displayName ?? null,
      position: { ...position, x: position.x, y: position.y, z: position.z },
      rotation: state?.rotation ?? position.rotation ?? 0,
      color: state?.color ?? position.color ?? null,
      pose: state?.pose ?? position.pose ?? "Stand",
      caught: Boolean(state?.caught),
    };
  });

  const game = gameData.get(roomId);
  const isPlaying = game?.status === "playing";
  sendMessage(socket, "room-snapshot", {
    roomId,
    hostId: roomHosts.get(roomId),
    state: roomState.get(roomId),
    phase: isPlaying ? game.phase : "lobby",
    totalMembers: roomMembers.size,
    members,
    players,
    yourRole: isPlaying ? game.roles.get(playerId) ?? null : null,
    game: isPlaying ? {
      startedAt: game.startedAt,
      phase: game.phase,
      totalHunters: game.totalHunters,
      remainingHiders: game.remainingHiders,
    } : null,
  });
}