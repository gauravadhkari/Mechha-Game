export const playerToSocket = new Map();
export const socketToPlayer = new Map();

export const rooms = new Map();
export const playerToRoom = new Map();
export const roomHosts = new Map();
export const readyPlayers = new Map();
export const roomState = new Map();

export const gameData = new Map();
export const gameTimers = new Map();
export const playerPositions = new Map();
export const playerStates = new Map();

export function createPlayerState(playerId) {
  return {
    playerId,
    displayName: null,
    roomId: null,
    role: null,
    pose: "Stand",
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    color: null,
    caught: false,
    connected: true,
  };
}

export function resetPlayerState(playerId, { keepRoom = true } = {}) {
  const state = playerStates.get(playerId);
  if (!state) return;

  if (!keepRoom) state.roomId = null;
  state.role = null;
  state.pose = "Stand";
  state.position = { x: 0, y: 0, z: 0 };
  state.rotation = 0;
  state.color = null;
  state.caught = false;

  playerPositions.delete(playerId);
}

export function clearGameTimers(roomId) {
  const timers = gameTimers.get(roomId);
  if (!timers) return;

  if (typeof timers === "object") {
    if (timers.hideTimer) clearTimeout(timers.hideTimer);
    if (timers.huntTimer) clearTimeout(timers.huntTimer);
  } else {
    // Backward-compatible cleanup if a room still has a single timer handle.
    clearTimeout(timers);
  }

  gameTimers.delete(roomId);
}

export function clearRoomData(roomId) {
  clearGameTimers(roomId);
  rooms.delete(roomId);
  roomHosts.delete(roomId);
  readyPlayers.delete(roomId);
  roomState.delete(roomId);
  gameData.delete(roomId);
}