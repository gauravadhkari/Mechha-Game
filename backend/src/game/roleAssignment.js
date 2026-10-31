export function hunterNum(size) {
 if (size >= 2 && size <= 5) return 1;
  if (size >= 6 && size <= 9) return 2;
  return 0;
}

export function shufflePlayers(playerIds) {
  const shuffled = [...playerIds];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function assignRoles(playerIds) {
  const shuffledPlayers = shufflePlayers(playerIds);
  const totalHunters = hunterNum(playerIds.length);
  const roles = new Map();

  for (let i = 0; i < shuffledPlayers.length; i += 1) {
    roles.set(shuffledPlayers[i], i < totalHunters ? "hunter" : "hider");
  }

  return {
    roles,
    totalHunters,
    remainingHiders: playerIds.length - totalHunters,
    caughtHiders: new Set(),
    removedHiders: new Set(),
    removedHunters: new Set(),
    startedAt: Date.now(),
    endedAt: null,
    winner: null,
    status: "playing",
    phase: "hiding",
  };
}