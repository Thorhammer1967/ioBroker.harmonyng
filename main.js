"use strict";

const utils = require("@iobroker/adapter-core");
const HarmonyNgClient = require("./lib/harmonyng-api");

class HarmonyNg extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: "harmonyng",
        });
        this.client = null;
        this.pollTimer = null;
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async onReady() {
        const cfg = this.config || {};
        this.client = new HarmonyNgClient({
            host: cfg.host || "192.168.178.195",
            port: cfg.port || 8089,
            log: this.log,
        });

        // subscribe to state changes for activities
        this.subscribeStates("activities.*");
        this.subscribeStates("devices.*.command");

        await this.refreshAll();
        this.pollTimer = this.setInterval(() => this.refreshAll(), (cfg.pollInterval || 30) * 1000);

        if (cfg.useWs !== false) {
            this.client.connectWs((msg) => this._onWsEvent(msg));
        }
    }

    async _onWsEvent(msg) {
        if (msg && (msg.activity !== undefined || msg.type === "activity")) {
            await this.refreshActivity();
        }
    }

    async refreshAll() {
        try {
            const status = await this.client.getStatus();
            if (status.status === 200 && status.data && status.data.ok) {
                await this.setStateAsync("info.connection", true, true);
                await this.setStateAsync("info.version", `${status.data.version} (fw ${status.data.firmware})`, true);
            } else {
                await this.setStateAsync("info.connection", false, true);
            }
        } catch (e) {
            this.log.warn(`status failed: ${e.message}`);
            this.setState("info.connection", false, true).catch(() => {});
        }

        await this.refreshActivities().catch((e) => this.log.warn(`activities failed: ${e.message}`));
        await this.refreshDevices().catch((e) => this.log.warn(`devices failed: ${e.message}`));
        await this.refreshActivity().catch((e) => this.log.debug(`activity failed: ${e.message}`));
    }

    async refreshActivities() {
        try {
            const res = await this.client.getActivities();
            if (res.status !== 200 || !res.data) return;
            const acts = res.data.activities || [];
            for (const act of acts) {
                const id = this._sanitize(act.label || String(act.id));
                await this.setObjectNotExistsAsync(`activities.${id}`, {
                    type: "channel",
                    common: { name: act.label || id },
                    native: { activityId: String(act.id) },
                });
                await this.setObjectNotExistsAsync(`activities.${id}.start`, {
                    type: "state",
                    common: {
                        name: "Start activity",
                        type: "boolean",
                        role: "button",
                        read: false,
                        write: true,
                        def: false,
                    },
                    native: { activityId: String(act.id) },
                });
                await this.setObjectNotExistsAsync(`activities.${id}.active`, {
                    type: "state",
                    common: {
                        name: "Activity active",
                        type: "boolean",
                        role: "indicator",
                        read: true,
                        write: false,
                        def: false,
                    },
                    native: { activityId: String(act.id) },
                });
            }
            // PowerOff activity (-1) as stop-all
            await this.setObjectNotExistsAsync("activities.powerOff", {
                type: "channel",
                common: { name: "Power Off (all devices)" },
                native: { activityId: "-1" },
            });
            await this.setObjectNotExistsAsync("activities.powerOff.start", {
                type: "state",
                common: { name: "Stop all", type: "boolean", role: "button", read: false, write: true, def: false },
                native: { activityId: "-1" },
            });
        } catch (e) {
            this.log.warn(`activities failed: ${e.message}`);
        }
    }

    async refreshDevices() {
        try {
            const res = await this.client.getDevices();
            if (res.status !== 200 || !res.data) return;
            const devs = res.data.devices || [];
            for (const dev of devs) {
                const id = this._sanitize(dev.name || String(dev.id));
                await this.setObjectNotExistsAsync(`devices.${id}`, {
                    type: "channel",
                    common: { name: dev.name || id },
                    native: { deviceId: String(dev.id) },
                });
                await this.setObjectNotExistsAsync(`devices.${id}.command`, {
                    type: "state",
                    common: {
                        name: "Send command",
                        type: "string",
                        role: "text",
                        read: false,
                        write: true,
                        def: "",
                    },
                    native: { deviceId: String(dev.id) },
                });
            }
        } catch (e) {
            this.log.warn(`devices failed: ${e.message}`);
        }
    }

    async refreshActivity() {
        try {
            const res = await this.client.getActivity();
            if (res.status !== 200 || !res.data) return;
            await this.setStateAsync("info.currentActivity", String(res.data.activity ?? "-1"), true);
            // mark active activity states
            const acts = await this.client.getActivities();
            if (acts.status === 200 && acts.data) {
                for (const act of acts.data.activities || []) {
                    const id = this._sanitize(act.label || String(act.id));
                    const isActive = String(act.id) === String(res.data.activity);
                    await this.setStateAsync(`activities.${id}.active`, isActive, true);
                }
            }
        } catch (e) {
            this.log.debug(`activity failed: ${e.message}`);
        }
    }

    async onStateChange(id, state) {
        if (!state || state.ack) return;
        if (!id.startsWith(this.namespace + ".")) return;
        const rel = id.slice(this.namespace.length + 1);

        if (rel.startsWith("activities.") && rel.endsWith(".start")) {
            const obj = await this.getObjectAsync(rel);
            const activityId = obj && obj.native && obj.native.activityId;
            if (activityId === "-1") {
                await this.client.stopActivity();
            } else {
                await this.client.startActivity(activityId);
            }
            await this.setStateAsync(id, false, true); // reset button
            await this.refreshActivity();
        }

        if (rel.startsWith("devices.") && rel.endsWith(".command")) {
            const obj = await this.getObjectAsync(rel.slice(0, -".command".length));
            const deviceId = obj && obj.native && obj.native.deviceId;
            const command = state.val;
            if (deviceId && command) {
                this.log.info(`send command ${command} -> device ${deviceId}`);
                await this.client.sendCommand(deviceId, String(command));
            }
            await this.setStateAsync(id, "", true); // clear
        }
    }

    _sanitize(name) {
        return String(name)
            .replace(/[^a-zA-Z0-9_\- äöüÄÖÜß]/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 80);
    }

    onUnload(callback) {
        if (this.pollTimer) this.clearInterval(this.pollTimer);
        if (this.client) this.client.close();
        callback();
    }
}

if (require.main !== module) {
    module.exports = (options) => new HarmonyNg(options);
} else {
    new HarmonyNg();
}
