import { HIDE_DURATION_MS, HUNT_DURATION_MS } from "../config/constants.js";
import { gameData, gameTimers, clearGameTimers } from "../state/store.js";
import { endGame } from "./endGame.js";
import { sendToRoom } from "../utils/sendMessage.js";

export function startGameTimers(roomId) {
  clearGameTimers(roomId);

  const timers = { hideTimer: null, huntTimer: null };
  gameTimers.set(roomId, timers);

  timers.hideTimer = setTimeout(() => {
    if (gameTimers.get(roomId) !== timers) return;

    const game = gameData.get(roomId);
    if (!game || game.status !== "playing") return;

    timers.hideTimer = null;
    game.phase = "hunting";

    sendToRoom(roomId, "hunting-started", {
      phase: "hunting",
      message: "Hunting Started!",
    });

    timers.huntTimer = setTimeout(() => {
      if (gameTimers.get(roomId) !== timers) return;

      const activeGame = gameData.get(roomId);
      if (activeGame?.status === "playing") {
        endGame(roomId, "hiders", "time-expired");
      }
    }, HUNT_DURATION_MS);
  }, HIDE_DURATION_MS);
}