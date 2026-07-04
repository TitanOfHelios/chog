# The 7 Seconds Chog — TypeScript Multiplayer

A single-room, 3D game where everyone moves around in the same space at
the same time. One command runs both the server and the client together.

## Features

- **Single-command run**: `npm run dev` from the root starts both the
  server and the client at the same time (`concurrently`).
- **TypeScript**: both `server/` and `client/` are fully TS.
- **A SINGLE `.env` file**: server port, arena settings, WebSocket
  address, 3D model file paths, character/coin/plate sizes, movement
  speed, camera and joystick settings — everything is read from **one
  `.env`** file at the project root. You never need to touch the code
  to change something; just edit `.env` and restart. The `ws://`
  address is **not shown/requested** on the login screen — it's
  automatically pulled from `.env`.
- **No walking animation**: the character doesn't sway/bounce; only
  its position and direction change. Your model stays fixed in its
  **original appearance** from the GLB file.
- **Simple, library-free joystick**: a plain virtual joystick that
  uses no external packages and works directly with
  touch/mouse events. Its behavior is completely straightforward: push
  right and the character moves right in the world, push forward and
  it moves forward, push back and it moves back — the joystick doesn't
  rotate the camera, it only makes the character walk. Drag the screen
  to rotate the camera. On keyboard, W/S for forward/back and A/D to
  rotate the camera (and character) continue to work as before.
- **Gradual acceleration**: holding down SPRINT gradually increases
  speed (reaching maximum in ~2 seconds), and releasing it smoothly
  returns to normal.
- **Three custom models**: `character.glb` (player), `coin.glb` (coin),
  and `island.glb` (island/ground). If any are missing, the game runs
  smoothly with simple placeholders (purple capsule/sphere, procedural
  ground — no more grass).
- **Selectable name plates**: put as many `.glb` plate models as you
  like into the `client/public/assets/plate/` folder and add them to
  `manifest.json` — they automatically become selectable via small
  preview cards on the login screen. The plate you choose is shown on
  your own character and is also sent to other players, so everyone
  sees the same plate. Each plate has a subtle light attached to it so
  it stays readable regardless of the world's sun angle. The plate's
  width **automatically stretches/shrinks based on the name** (narrower
  for short names, wider for long ones); the height/depth ratio is not
  distorted. If no plates are added at all, the selection screen
  doesn't appear, and names are shown as plain text labels.
- **Central statue**: a deliberately colorless/plain simple stone
  statue stands at the center of the map, requiring no `.glb`
  (can be toggled on/off via `VITE_STATUE_*`, with adjustable color/size).
- **Credits area**: if `VITE_CREDITS_TEXT` (and optionally
  `VITE_CREDITS_URL`) is filled in, a small credits note appears below
  the login screen; if empty, it doesn't appear at all.
- **Purple UI**: the login screen, HUD, coin timer bar, etc. are
  purple-themed.
- **Multiplayer**: automatic reconnection, ping indicator, join/leave,
  server-side heartbeat, message validation.

## Setup

```bash
npm install
```

This single command installs all dependencies for the root, `server/`,
and `client/` (via the `postinstall` script).

Then create the **single `.env` file** (at the project root, NEXT TO
the `server/` and `client/` folders — not inside them):

```bash
cp .env.example .env
```

## Running (single command)

```bash
npm run dev
```

- Server: `ws://localhost:8080` (or the `PORT` from `.env`)
- Client: `http://localhost:3000`

Open `http://localhost:3000` in your browser, type a name, and click
**Join Room**. The server address is automatically read from
`VITE_WS_URL` in the root `.env`; it's not shown separately on the
login screen.

Whenever you change `.env`, you need to stop and restart `npm run dev`
(both Vite and Node only read it on startup).

## A single `.env` file — everything here

There used to be two separate files, `server/.env` and `client/.env`;
now **a single file** (`.env` at the project root) feeds both. Names
prefixed with `VITE_` go to the browser (client); the rest go only to
the server. See the root **`.env.example`** file for the full list and
explanations; the main groups are:

```bash
# Server
PORT=8080
ARENA_RADIUS=85
COIN_CYCLE_MS=7000
TICK_MS=100
HEARTBEAT_MS=15000

# Client: server address
VITE_WS_URL=ws://localhost:8080   # if testing from a phone, use your LAN IP

# Client: 3D model file paths
VITE_CHARACTER_MODEL_PATH=/assets/character.glb
VITE_COIN_MODEL_PATH=/assets/coin.glb
VITE_ISLAND_MODEL_PATH=/assets/island.glb
VITE_PLATE_FOLDER=/assets/plate/   # plates listed in the folder's manifest.json

# Client: sizes
VITE_CHARACTER_HEIGHT=1.3
VITE_COIN_HEIGHT=0.55
VITE_PLATE_MIN_WIDTH=1.1
VITE_PLATE_MAX_WIDTH=3.4
VITE_PLATE_WIDTH_PER_CHAR=0.16

# Client: movement / physics
VITE_MOVE_SPEED=4.2
VITE_TURN_SPEED=3.0
VITE_JUMP_VELOCITY=6.2
VITE_GRAVITY=-16
VITE_SPRINT_MAX_MULT=2.8
VITE_SPRINT_RAMP_TIME=2.0
VITE_SPRINT_DECAY_RATE=1.6

# Client: camera
VITE_CAMERA_DISTANCE=7
VITE_CAMERA_DISTANCE_MIN=3
VITE_CAMERA_DISTANCE_MAX=16
VITE_CAMERA_PITCH=0.38

# Client: joystick
VITE_JOYSTICK_DEADZONE=0.1
```

`VITE_WS_URL` is the WebSocket address the client connects to (e.g.
after deploying the server to a service like Render/Railway, put the
`wss://...` address here and rebuild). There is **no** separate box for
this address on the login screen — it's automatically injected at
build time.

## Your own 3D models

By default, all models go into the `client/public/assets/` folder and
are **automatically** detected (if a file is missing, the game falls
back smoothly to a placeholder/procedural version). If you want to
change the file name/folder, you just need to update the
`VITE_..._MODEL_PATH` value in `.env` instead of the code:

| File (default path) | What it does | What happens if missing |
|---|---|---|
| `client/public/assets/character.glb` | Player character | Simple purple capsule placeholder |
| `client/public/assets/coin.glb` | Collectible coin | Simple purple sphere placeholder |
| `client/public/assets/plate/*.glb` + `manifest.json` | Selectable name plates | Plain text label (selection screen doesn't appear either) |

### Adding a name plate (multiple, selectable)

`plate.glb` is no longer a single file — you put as many `.glb` files
as you like into the `client/public/assets/plate/` folder and register
them in the `manifest.json` in the same folder:

```json
[
  { "id": "neon", "file": "neon.glb", "label": "Neon" },
  { "id": "ahsap", "file": "ahsap.glb", "label": "Wooden Sign" }
]
```

Each one appears as a small 3D preview card on the login screen; the
player picks one (or says "No Plate"), the choice is sent to the
server, and other players see the same plate too. If `manifest.json`
is left empty (`[]`), the selection area doesn't appear at all —
nothing breaks. See `client/public/assets/plate/README.md` for the
detailed format.

`character.glb` already comes with your uploaded model (~34 MB, Draco
compressed). You can adjust its height with `VITE_CHARACTER_HEIGHT` in
`.env` (default 1.3 units); the model is automatically scaled, has its
base placed on the ground, and is centered — **no deformation or
animation is applied**, your model looks exactly as you designed it.

### Adding your name plate

See the "Adding a name plate (multiple, selectable)" section above —
just put your `.glb` files into `client/public/assets/plate/` and
register them in `manifest.json`.

## Controls

- **Joystick (bottom left, library-free)**: push right and the
  character goes right, push forward and it goes forward, push back
  and it goes back. The joystick doesn't rotate the camera, it only
  makes the character walk. Works with both touch and mouse.
- **Keyboard**: W/S forward-back, A/D to rotate the camera (and
  character) — gives full control on desktop.
- **Drag the screen/mouse**: changes the viewing angle (you can turn
  the camera in any direction you like).
- **Pinch with two fingers / mouse wheel**: zoom in-out.
- **JUMP**: jumping (the Space key also works).
- **SPRINT**: speed gradually increases the longer you hold it down
  (Shift also works).

## Game rules

- Single room, always open.
- A **coin** appears at a random point, with a **7 second**
  (`COIN_CYCLE_MS`) time limit — that's where the game's name comes
  from.
- Whoever catches it first within that time gets +1 point, and the
  coin immediately appears in a new spot. If no one catches it, it
  also reappears in a new spot.
- The **LEADERBOARD** button in the top right shows the score table.

## Project structure

```
server/
  src/
    index.ts     # entry point, reads .env, WebSocketServer
    room.ts      # room/game logic: players, coin cycle, heartbeat
    types.ts     # client <-> server message types
client/
  public/assets/ # character.glb / coin.glb / plate/*.glb+manifest.json go here
  src/
    main.ts             # sets up the scene, runs the loop
    config.ts            # reads .env values
    types.ts             # message types (synced with server/types.ts)
    net/GameClient.ts    # WS client: reconnection, ping/latency
    scene/Sky.ts          # sky texture
    scene/Terrain.ts      # island model or procedural terrain + height query
    character/CharacterFactory.ts # loads character.glb (placeholder fallback)
    character/Coin.ts             # loads coin.glb (placeholder fallback)
    character/NameTag.ts          # plain name text (canvas sprite)
    character/NamePlate.ts        # combination of selected plate/*.glb + name text
    character/plateManifest.ts    # plate/manifest.json reader (shared)
    character/PlateThumbnails.ts  # plate preview images for the login screen
    input/Joystick.ts             # library-free simple touch/mouse joystick
    input/Keyboard.ts, CameraRig.ts
    ui/Login.ts (includes plate selection grid), Hud.ts
```

## Production build (optional)

```bash
npm run build   # produces server/dist and client/dist
npm start       # runs the compiled server + client preview
```
