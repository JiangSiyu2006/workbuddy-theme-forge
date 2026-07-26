import test from "node:test";
import assert from "node:assert/strict";
import { filterRendererTargets } from "../src/cdp-client.mjs";
test("filters renderer targets to loopback pages", () => { const targets = filterRendererTargets([{type:"page",url:"file:///renderer/index.html",webSocketDebuggerUrl:"ws://127.0.0.1:9223/devtools/1"},{type:"page",url:"https://example.com",webSocketDebuggerUrl:"ws://127.0.0.1:9223/devtools/2"},{type:"service_worker",url:"file:///renderer",webSocketDebuggerUrl:"ws://127.0.0.1:9223/devtools/3"}]); assert.equal(targets.length,1); });
