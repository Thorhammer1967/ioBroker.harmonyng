# Rooting a Logitech Harmony Hub (harmony-ng)

The ioBroker adapter only **controls** an already-rooted hub. Rooting itself needs
**physical USB access** to the hub, so it is a separate step — but the tools ship
with this repo so everything lives in one place.

## Requirements
- Linux PC with the hub connected via **USB (micro-USB, front port recommended)**
- `python3`, `libusb` (`sudo apt install libusb-1.0-0 python3-pip`), `pip install pyusb` or the repo venv
- Your SSH **public key** (`~/.ssh/id_ed25519.pub` or generate one: `ssh-keygen -t ed25519`)

## Step 1 — Root the hub
```bash
cd tools
python3 root_hub_usb.py --wifi-ssid "DEIN_WLAN" --wifi-pass "DEIN_PASS"
```
This permanently roots the hub: installs Dropbear SSH (starts on every boot),
adds your SSH key and disables the watchdog. No Logitech cloud needed.

## Step 2 — Deploy harmony-ng firmware
```bash
python3 deploy_hub.py <HUB_IP>          # e.g. 192.168.178.195
```
Uploads the harmony-ng service + WebUI (port 8089) to the hub.

## Step 3 — Install & configure the ioBroker adapter
In ioBroker Admin add instance `harmonyng.0`, enter the hub IP (default port 8089).
Activities and devices appear automatically.

## Source
Rooting/deploy tooling is from [iranl/harmony-ng](https://github.com/iranl/harmony-ng)
(MIT license © iranl and contributors) — see https://github.com/iranl/harmony-ng/issues/221
