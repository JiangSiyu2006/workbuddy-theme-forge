import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { WebSocketServer } from "ws";
import { applyTheme, restoreAll } from "../src/runtime.mjs";
import { readState, writeState } from "../src/state.mjs";

const home = join(process.cwd(), ".test-tmp", "runtime-transaction");

async function mockCdp({ failTarget = null } = {}) {
  const restored = [];
  const http = createServer((req, res) => {
    if (req.url !== "/json/list") return res.end("not found");
    const port = http.address().port;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(["one", "two"].map((id) => ({ id, type: "page", url: `file:///renderer/${id}`, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/${id}` }))));
  });
  const ws = new WebSocketServer({ noServer: true });
  http.on("upgrade", (req, socket, head) => ws.handleUpgrade(req, socket, head, (client) => ws.emit("connection", client, req)));
  ws.on("connection", (client, req) => {
    const targetId = req.url.split("/").at(-1);
    let injection = null;
    client.on("message", (bytes) => {
      const message = JSON.parse(bytes);
      const expression = message.params.expression;
      let value;
      if (expression.includes("({url:location.href,applicationName:")) value = { url: `file:///renderer/${targetId}`, applicationName: "WorkBuddy" };
      else if (expression.includes("const regions=")) value = Object.fromEntries(["root", "sidebar", "main", "chat", "topbar", "input", "panel"].map((name) => [name, { hit: true }]));
      else if (expression.includes("const applicationName=")) value = { version: "5.3.5", identity: { applicationName: "WorkBuddy" }, variables: {}, appearance: {}, injection };
      else if (expression.includes("current={htmlClass")) value = { hadStyle: false, css: "", styleData: null, themeAttr: null, appearance: {}, baseAppearance: {} };
      else if (expression.includes("let el=document.getElementById")) {
        if (targetId === failTarget) return client.send(JSON.stringify({ id: message.id, result: { exceptionDetails: { text: "mock injection failure" } } }));
        const hash = JSON.parse(expression.match(/el\.dataset\.hash=("[a-f0-9]+")/)[1]);
        injection = { themeId: "aurora-night", hash, adapterId: "adapter-535", bytes: 100 };
        value = injection;
      } else if (expression.includes("rolledBack:true")) { restored.push(targetId); injection = null; value = { rolledBack: true, native: true }; }
      else if (expression.includes("restored:true")) { restored.push(targetId); injection = null; value = { restored: true }; }
      else value = null;
      client.send(JSON.stringify({ id: message.id, result: { result: { value } } }));
    });
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  return { port: http.address().port, restored, close: () => new Promise((resolve) => ws.close(() => http.close(resolve))) };
}

test("multi-renderer apply commits state only after every renderer succeeds", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(home, { recursive: true, force: true }); await mkdir(home, { recursive: true });
  await writeState({ status: "native", themeId: null });
  const cdp = await mockCdp();
  try {
    const result = await applyTheme("aurora-night", { port: cdp.port, ownerVerified: true });
    assert.equal(result.targets.length, 2);
    assert.equal(result.targets.every((item) => item.ok), true);
    assert.equal((await readState()).status, "active");
  } finally { await cdp.close(); await rm(home, { recursive: true, force: true }); }
});

test("restore publishes the final desired state only after every renderer succeeds", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(home, { recursive: true, force: true }); await mkdir(home, { recursive: true });
  await writeState({ status: "active", themeId: "aurora-night" });
  const cdp = await mockCdp();
  try {
    await restoreAll({ port: cdp.port, ownerVerified: true, status: "paused", keepTheme: true });
    const state = await readState();
    assert.equal(state.status, "paused");
    assert.equal(state.themeId, "aurora-night");
  } finally { await cdp.close(); await rm(home, { recursive: true, force: true }); }
});

test("partial renderer failure rolls back changed renderers and leaves state inactive", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(home, { recursive: true, force: true }); await mkdir(home, { recursive: true });
  await writeState({ status: "native", themeId: null });
  const cdp = await mockCdp({ failTarget: "two" });
  try {
    await assert.rejects(() => applyTheme("aurora-night", { port: cdp.port, ownerVerified: true }), (error) => {
      assert.match(error.message, /transaction failed/);
      assert.equal(error.details.targets.at(-1).targetId, "two");
      return true;
    });
    assert.deepEqual(cdp.restored.sort(), ["one", "two"]);
    assert.equal((await readState()).status, "native");
  } finally { await cdp.close(); await rm(home, { recursive: true, force: true }); }
});
