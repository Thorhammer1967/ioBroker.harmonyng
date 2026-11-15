"use strict";

// Live integration test against the real rooted hub (no mocking).
// Usage: node test/live-test.js [host] [port]
const HarmonyNgClient = require("../lib/harmonyng-api");

const host = process.argv[2] || "192.168.178.195";
const port = Number(process.argv[3] || 8089);

let failures = 0;
function check(name, cond, extra) {
    const ok = !!cond;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra !== undefined ? "  -> " + JSON.stringify(extra).slice(0, 100) : ""}`);
    if (!ok) failures++;
}

(async () => {
    const c = new HarmonyNgClient({ host, port, log: console });

    const status = await c.getStatus();
    check("GET /api/status 200 + ok", status.status === 200 && status.data && status.data.ok === true, status.data);
    check("status has version", typeof status.data?.version === "string", status.data?.version);

    const acts = await c.getActivities();
    check("GET /api/activities 200 + array", acts.status === 200 && Array.isArray(acts.data?.activities), `count=${acts.data?.activities?.length}`);

    const devs = await c.getDevices();
    check("GET /api/devices 200 + array", devs.status === 200 && Array.isArray(devs.data?.devices), `count=${devs.data?.devices?.length}`);
    const firstDev = devs.data?.devices?.[0];
    if (firstDev) {
        const cmds = await c.getDeviceCommands(firstDev.id);
        check(`GET /api/device-commands?id=${firstDev.id} 200 + array`, cmds.status === 200 && Array.isArray(cmds.data?.commands), `cmds=${cmds.data?.commands?.length}`);
    }

    const act = await c.getActivity();
    check("GET /api/activity 200", act.status === 200 && act.data && "activity" in act.data, act.data);

    // write ops: stopActivity is idempotent/safe, then verify
    const stop = await c.stopActivity();
    check("POST /api/activity-stop 200", stop.status === 200, stop.data);
    const after = await c.getActivity();
    check("activity is -1 (off) after stop", String(after.data?.activity) === "-1", after.data?.activity);

    // ws connects
    await new Promise((resolve) => {
        c.connectWs(() => {});
        const t = setTimeout(() => { check("WS /websocket connects", false); resolve(); }, 6000);
        const orig = c.ws;
        orig.on("open", () => { clearTimeout(t); check("WS /websocket connects", true); setTimeout(() => { c.close(); resolve(); }, 300); });
    });

    console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
    console.error("TEST RUN ERROR:", e.message);
    process.exit(1);
});
