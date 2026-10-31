
A modular Node.js WebSocket backend that combines the existing server's room/lobby/game rules with the useful gameplay state features from the second implementation.

## Requirements

- Node.js 20 or newer recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

For a normal run:

```bash
npm start
```

The WebSocket server listens on port `8080` by default. Optional environment variables:

- `PORT` — WebSocket port
- `HIDE_DURATION_MS` — hiding phase duration (default `60000`)
- `HUNT_DURATION_MS` — hunting phase duration (default `60000`)

Run the automated checks with:

```bash
npm test
```

## File structure

```text
src/
├── server.js
├── config/
│   └── constants.js
├── state/
│   └── store.js
├── websocket/
│   ├── connection.js
│   └── messageRouter.js
├── handlers/
│   ├── roomHandlers.js
│   ├── gameHandlers.js
│   ├── positionHandlers.js
│   └── playerHandlers.js
├── lifecycle/
│   └── playerRemoval.js
├── game/
│   ├── roleAssignment.js
│   ├── gameTimers.js
│   └── endGame.js
└── utils/
    └── sendMessage.js

test/
├── roleAssignment.test.js
└── endGame.test.js
```

## Message format

The unified protocol is:

```json
{
  "type": "message-name",
  "data": {}
}
```

The server generates a unique `playerId` when a WebSocket connects. Use that ID for identity and authorization; do not trust a client-supplied username or room ID to identify the sender.

## Supported messages

| Incoming `type` | Purpose |
| --- | --- |
| `user-setup` | Set a display name with `data.userName` or `data.displayName` |
| `create-room` | Create a room; response includes `roomId` and `hostId` |
| `join-room` | Join an existing lobby with `data.roomId` |
| `leave-room` | Leave the room; leaving during a game updates win conditions |
| `set-ready` | Set `data.ready` to `true` or `false` |
| `room-state` | Request the lobby's host, members, and readiness |
| `start-game` | Host starts when at least two players are present and everyone is ready |
| `catch-player` | Hunter catches a hider using `data.targetId` |
| `update-position` | Send `data.x`, `data.y`, and `data.z`; optional rotation/color/pose are accepted |
| `get-positions` | Request saved player positions |
| `changed-pose` | Set `data.pose` |
| `request-state` | Request a room snapshot |
| `echo` | Simple connection test |

## Compatibility aliases from the friend's implementation

These incoming message types are accepted and translated into the unified protocol:

- `movement` → `update-position`. Supports `data.coordinates: { x, y, z, ry, col }`.
- `mark-caught` → `catch-player`. The sender is determined from the socket. `targetId`/`targetPlayerId` is preferred; `targetUsername` can be resolved only when it matches exactly one player's configured display name.
- `changed-pose` → pose update.
- `request-state` → room snapshot.
- `user-setup` → display-name setup.
- The old misspelling `get-positons` is still accepted as an alias for `get-positions`.

Incoming compatibility aliases do **not** mean the server sends the friend's old `{ event, message }` response format. Responses use `{ type, data }` so the backend has one consistent protocol. A frontend using the friend's old event names should be updated to consume these response types.

## Gameplay behavior

- Rooms use `lobby`, `playing`, and the game record's `hiding`, `hunting`, and `ended` phases.
- The hiding phase runs for 60 seconds by default, followed by a 60-second hunting phase.
- Hunters are assigned using the existing rule: 1 hunter for 2–5 players, 2 hunters for 6–9 players. The current rule returns 0 hunters outside that range; decide the intended rule before supporting larger rooms.
- A hider caught or removed is not counted twice.
- If every hider is caught/removed, hunters win. If every hunter leaves/disconnects, hiders win. If time expires, hiders win.
- At the end of a round, the result is broadcast, player role/pose/position state is reset, the room returns to the lobby, and everyone must ready up again.
- Disconnect and manual leave share the same cleanup logic; the host is transferred if necessary.

## Important limitations

- This is an in-memory prototype. Restarting the server clears rooms and game state.
- `catch-player` is **not** the planned raycast/hitscan shooting system. The server validates room membership, role, game phase, and duplicate catches, but it does not yet validate distance or line of sight.
- Display names are labels only and are not unique identities.
- `join-room` joins an existing room. The host should first use `create-room` and share the returned room ID.
'''
}
for rel, content in files.items():
    path = base / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
print(f"Wrote {len(files)} files under {base}")