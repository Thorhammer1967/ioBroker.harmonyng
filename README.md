# ioBroker.harmonyng

ioBroker adapter for a **Logitech Harmony Hub running [harmony-ng](https://github.com/iranl/harmony-ng)** firmware (MIT license © iranl and contributors).

The adapter talks to the hub's local REST + WebSocket API on **port 8089** — no Logitech cloud needed.

## Features
- Connection status, harmony-ng version, current activity
- All activities as channels with **start** button and **active** indicator
- "Power Off" channel to stop all activities
- All devices with a writable **command** state (send any IR/RF/BT command by name)
- Live updates via WebSocket (`/websocket`), polling fallback

## Setup
1. Root your Harmony Hub with harmony-ng (`tools/root_hub_usb.py` + `deploy_hub.py` from the harmony-ng releases).
2. Install this adapter in ioBroker Admin.
3. Enter the hub IP (default port 8089).
4. Activities and devices appear automatically as states.

## Usage
- `harmonyng.0.activities.<Name>.start` → set `true` to start the activity
- `harmonyng.0.activities.powerOff.start` → set `true` to turn everything off
- `harmonyng.0.devices.<Device>.command` → write a command name (e.g. `VolumeUp`) to send it

## API endpoints used
`GET /api/status`, `GET /api/activities`, `GET /api/devices`, `GET /api/activity`, `GET /api/device-commands?id=`, `POST /api/activity-start`, `POST /api/activity-stop`, `POST /api/ir-send`, `WS /websocket`

## License
MIT. Uses the REST API of harmony-ng (MIT, © 2026 iranl and contributors) — see https://github.com/iranl/harmony-ng/issues/221
