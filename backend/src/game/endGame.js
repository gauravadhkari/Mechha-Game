import {
  gameData,
  readyPlayers,
  roomState,
  rooms,
  clearGameTimers,
  resetPlayerState,
} from "../state/store.js";
import { sendToRoom } from "../utils/sendMessage.js";

export function endGame(roomId, winner, reason = "round-finished") {
  const game = gameData.get(roomId);
  if (!game || game.status !== "playing") return false;

  game.status = "finished";
  game.phase = "ended";
  game.winner = winner;
  game.endedAt = Date.now();

  clearGameTimers(roomId);

  sendToRoom(roomId, "game-over", {
    winner,
    reason,
    remainingHiders: game.remainingHiders,
    totalHunters: game.totalHunters,
    message: winner === "hunters" ? "Hunters Win!" : "Hiders Win!",
    rematchAvailable: true,
  });

  // Match the friend's round-reset behavior: keep the room, reset player
  // cosmetics/roles, and require everyone to ready up again for a rematch.
  for (const playerId of rooms.get(roomId) ?? []) {
    resetPlayerState(playerId, { keepRoom: true });
  }
  readyPlayers.get(roomId)?.clear();

  // The game record remains available for debugging until the next round.
  // The room itself returns to the lobby so players can play again.
  roomState.set(roomId, "lobby");
  return true;
}