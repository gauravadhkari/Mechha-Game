import {
  socketToPlayer,
  playerToRoom,
  rooms,
  roomHosts,
  readyPlayers,
  roomState,
  gameData,
  playerStates,
} from "../state/store.js";
import { assignRoles } from "../game/roleAssignment.js";
import { startGameTimers } from "../game/gameTimers.js";
import { endGame } from "../game/endGame.js";
import { resetPlayerState } from "../state/store.js";
import { sendError, sendMessage, sendToRoom } from "../utils/sendMessage.js";

export function handleStartGame(socket) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!roomId || !playerId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");

  const roomMembers = rooms.get(roomId);
  if (!roomMembers?.has(playerId)) {
    return sendError(socket, "Room membership was not found", "ROOM_MEMBERSHIP_NOT_FOUND");
  }
  if (roomState.get(roomId) !== "lobby") {
    return sendError(socket, "A game is already running", "GAME_IN_PROGRESS");
  }
  if (roomHosts.get(roomId) !== playerId) {
    return sendError(socket, "Only the host can start the game", "HOST_ONLY");
  }

  const readyState = readyPlayers.get(roomId);
  if (!readyState) return sendError(socket, "Room readiness state was not found", "READY_STATE_NOT_FOUND");

  const roomMembersArr = [...roomMembers];
  const allReady = roomMembersArr.length > 0 &&
    roomMembersArr.every((memberId) => readyState.has(memberId));

  if (!allReady) return sendError(socket, "All players must be ready", "PLAYERS_NOT_READY");
  if (roomMembersArr.length < 2) {
    return sendError(socket, "At least 2 players are required", "NOT_ENOUGH_PLAYERS");
  }

  const game = assignRoles(roomMembersArr);
  gameData.set(roomId, game);
  roomState.set(roomId, "playing");

  for (const memberId of roomMembersArr) {
    resetPlayerState(memberId, { keepRoom: true });
    const playerState = playerStates.get(memberId);
    if (playerState) playerState.role = game.roles.get(memberId);

    sendMessage(
      // The player's socket is looked up by the player ID, never supplied by the client.
      (awaitSocketLookup(memberId)),
      "game-started",
      {
        roomId,
        hostId: playerId,
        role: game.roles.get(memberId),
        phase: game.phase,
        startedAt: game.startedAt,
      },
    );
  }

  startGameTimers(roomId);
}

function awaitSocketLookup(playerId) {
  // Kept as a tiny helper to make the identity lookup explicit.
  // This is synchronous; the name is intentionally not async.
  return importSocketMap().get(playerId);
}

function importSocketMap() {
  return socketMap;
}

import { playerToSocket as socketMap } from "../state/store.js";

function resolveTarget(roomMembers, data) {
  const directId = data.targetId ?? data.targetPlayerId;
  if (typeof directId === "string" && directId.trim() !== "") {
    return { targetId: directId, ambiguous: false };
  }

  const targetName = data.targetUsername ?? data.targetUserName ?? data.targetName;
  if (typeof targetName !== "string" || targetName.trim() === "") {
    return { targetId: null, ambiguous: false };
  }

  const matches = [...roomMembers].filter(
    (memberId) => playerStates.get(memberId)?.displayName === targetName,
  );

  if (matches.length > 1) return { targetId: null, ambiguous: true };
  return { targetId: matches[0] ?? null, ambiguous: false };
}

export function handleCatchPlayer(socket, payload) {
  const playerId = socketToPlayer.get(socket);
  const roomId = playerToRoom.get(playerId);

  if (!playerId || !roomId) return sendError(socket, "You are not in a room", "NOT_IN_ROOM");

  const roomMembers = rooms.get(roomId);
  if (!roomMembers?.has(playerId)) {
    return sendError(socket, "You are not part of this room", "ROOM_MEMBERSHIP_NOT_FOUND");
  }

  const game = gameData.get(roomId);
  if (!game || game.status !== "playing" || roomState.get(roomId) !== "playing") {
    return sendError(socket, "The game is not running", "GAME_NOT_RUNNING");
  }
  if (game.phase !== "hunting") {
    return sendError(socket, "The hunting phase has not started", "HUNTING_NOT_STARTED");
  }

  const { targetId, ambiguous } = resolveTarget(roomMembers, payload.data ?? {});
  if (ambiguous) {
    return sendError(socket, "That display name is not unique; use targetId instead", "AMBIGUOUS_TARGET");
  }
  if (!targetId || !roomMembers.has(targetId)) {
    return sendError(socket, "Target player is not in this room", "TARGET_NOT_IN_ROOM");
  }

  if (game.roles.get(playerId) !== "hunter" || game.roles.get(targetId) !== "hider") {
    return sendError(socket, "Only a hunter can catch a hider", "INVALID_CATCH");
  }
  if (game.caughtHiders.has(targetId) || game.removedHiders.has(targetId)) {
    return sendError(socket, "That hider has already been caught or removed", "TARGET_ALREADY_CAUGHT");
  }

  game.caughtHiders.add(targetId);
  game.remainingHiders = Math.max(0, game.remainingHiders - 1);
  const targetState = playerStates.get(targetId);
  if (targetState) targetState.caught = true;

  sendToRoom(roomId, "player-caught", {
    hunter: playerId,
    hider: targetId,
    remainingHiders: game.remainingHiders,
  });

  if (game.remainingHiders === 0) endGame(roomId, "hunters", "all-hiders-caught");
}