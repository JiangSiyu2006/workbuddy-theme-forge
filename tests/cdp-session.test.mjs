import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { CdpSession, discoverTargets } from "../src/cdp-client.mjs";

test("mock CDP discovers multiple renderers and matches commands", async () => {
  const http = createServer((req, res) => {
    if (req.url === "/json/list") {
      const port = http.address().port;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([1, 2].map((id) => ({ id: String(id), type: "page", url: `file:///renderer/${id}`, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/${id}` }))));
    }
  });
  const ws = new WebSocketServer({ noServer: true });
  http.on("upgrade", (req, socket, head) => ws.handleUpgrade(req, socket, head, (client) => ws.emit("connection", client)));
  ws.on("connection", (client) => client.on("message", (bytes) => { const message = JSON.parse(bytes); client.send(JSON.stringify({ id: message.id, result: { result: { value: message.method } } })); }));
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  try {
    const port = http.address().port;
    const targets = await discoverTargets(port);
    assert.equal(targets.length, 2);
    const session = await new CdpSession(targets[0].webSocketDebuggerUrl).connect();
    assert.equal(await session.evaluate("1"), "Runtime.evaluate");
    session.close();
  } finally { await new Promise((resolve) => ws.close(() => http.close(resolve))); }
});

test("CDP command times out when the renderer does not answer", async () => {
  class SilentSocket {
    constructor() { queueMicrotask(() => this.onopen?.()); }
    send() {}
    close() { this.onclose?.(); }
  }
  const session = await new CdpSession("ws://127.0.0.1:9223/devtools/test", { WebSocketImpl: SilentSocket, timeoutMs: 10 }).connect();
  await assert.rejects(() => session.command("Runtime.evaluate"), /timed out/);
  session.close();
});
