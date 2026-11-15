// HarmonyNG Hub API client — talks to harmony-ng REST/WebSocket API on port 8089
const http = require("http");
const { WebSocket } = require("ws");

class HarmonyNgClient {
    constructor({ host, port = 8089, log }) {
        this.host = host;
        this.port = port;
        this.log = log || console;
        this.ws = null;
        this._msgId = 0;
        this._pending = new Map();
    }

    _request(method, path, body) {
        return new Promise((resolve, reject) => {
            const data = body !== undefined ? JSON.stringify(body) : null;
            const req = http.request(
                {
                    host: this.host,
                    port: this.port,
                    path,
                    method,
                    headers: {
                        "Content-Type": "application/json",
                        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
                    },
                    timeout: 8000,
                },
                (res) => {
                    let buf = "";
                    res.on("data", (c) => (buf += c));
                    res.on("end", () => {
                        try {
                            resolve({ status: res.statusCode, data: buf ? JSON.parse(buf) : null });
                        } catch {
                            resolve({ status: res.statusCode, data: buf });
                        }
                    });
                }
            );
            req.on("timeout", () => req.destroy(new Error("timeout")));
            req.on("error", (e) => {
                reject(e instanceof Error ? e : new Error(String(e)));
            });
            if (data) req.write(data);
            req.end();
        });
    }

    async getStatus() {
        return this._request("GET", "/api/status");
    }

    async getActivities() {
        return this._request("GET", "/api/activities");
    }

    async getDevices() {
        return this._request("GET", "/api/devices");
    }

    async getActivity() {
        return this._request("GET", "/api/activity");
    }

    async getDeviceCommands(deviceId) {
        return this._request("GET", `/api/device-commands?id=${encodeURIComponent(deviceId)}`);
    }

    async startActivity(id) {
        return this._request("POST", "/api/activity-start", { id: String(id) });
    }

    async stopActivity() {
        return this._request("POST", "/api/activity-stop", {});
    }

    async sendCommand(deviceId, command, duration = 0) {
        return this._request("POST", "/api/ir-send", { device: String(deviceId), command, duration });
    }

    connectWs(onEvent) {
        const url = `ws://${this.host}:${this.port}/websocket`;
        this.ws = new WebSocket(url);
        this.ws.on("open", () => this.log.info("harmonyng: WebSocket connected"));
        this.ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (onEvent) onEvent(msg);
            } catch (e) {
                this.log.debug(`harmonyng: ws parse error ${e.message}`);
            }
        });
        this.ws.on("close", () => {
            this.log.info("harmonyng: WebSocket closed, reconnecting in 10s");
            setTimeout(() => this.connectWs(onEvent), 10000);
        });
        this.ws.on("error", (e) => this.log.warn(`harmonyng: ws error ${e.message}`));
    }

    close() {
        if (this.ws) {
            this.ws.removeAllListeners("close");
            try { this.ws.close(); } catch { /* ignore */ }
            this.ws = null;
        }
    }
}

module.exports = HarmonyNgClient;
