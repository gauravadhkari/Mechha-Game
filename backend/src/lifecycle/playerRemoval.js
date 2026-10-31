import {
  playerToRoom,
  rooms,
  roomHosts,
  readyPlayers,
  roomState,
  gameData,
  playerStates,
  playerPositions,
  resetPlayerState,
  clearRoomData,
} from "../state/store.js";
import { sendToRoom } from "../utils/sendMessage.js";
import { endGame } from "../game/endGame.js";

export function removePlayerFromRoom(playerId, eventType = "player-left") {
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return null;

  const roomMembers = rooms.get(roomId);
  const playerState = playerStates.get(playerId);
  if (!roomMembers || !roomMembers.has(playerId)) {
    playerToRoom.delete(playerId);
    resetPlayerState(playerId, { keepRoom: false });
    return roomId;
  }

  const game = gameData.get(roomId);
  const gameWasPlaying = roomState.get(roomId) === "playing" && game?.status === "playing";

  if (gameWasPlaying) {
    const role = game.roles.get(playerId);

    if (role === "hider" &&
        !game.caughtHiders.has(playerId) &&
        !game.removedHiders.has(playerId)) {
      game.removedHiders.add(playerId);
      game.remainingHiders = Math.max(0, game.remainingHiders - 1);
    }

    if (role === "hunter" && !game.removedHunters.has(playerId)) {
      game.removedHunters.add(playerId);
      game.totalHunters = Math.max(0, game.totalHunters - 1);
    }
  }

  roomMembers.delete(playerId);
  playerToRoom.delete(playerId);
  readyPlayers.get(roomId)?.delete(playerId);
  playerPositions.delete(playerId);
  resetPlayerState(playerId, { keepRoom: false });

  sendToRoom(roomId, eventType, {
    playerId,
    displayName: playerState?.displayName ?? null,
    remainingHiders: game?.remainingHiders ?? null,
    totalHunters: game?.totalHunters ?? null,
  });

  if (gameWasPlaying && game?.status === "playing") {
    if (game.totalHunters <= 0) {
      endGame(roomId, "hiders", "all-hunters-left");
    } else if (game.remainingHiders <= 0) {
      endGame(roomId, "hunters", "all-hiders-left");
    }
  }

  if (roomMembers.size === 0) {
    clearRoomData(roomId);
    return roomId;
  }

  if (roomHosts.get(roomId) === playerId) {
    const newHostId = roomMembers.values().next().value;
    roomHosts.set(roomId, newHostId);
    sendToRoom(roomId, "host-changed", { hostId: newHostId });
  }

  return roomId;
}