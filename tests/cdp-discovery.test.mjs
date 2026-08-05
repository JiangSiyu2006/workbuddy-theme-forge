import test from "node:test";
import assert from "node:assert/strict";
import { candidatePorts, discoverVerifiedTargets, isWorkBuddyOwner, resolveCdpEndpoint } from "../src/cdp-discovery.mjs";

test("CDP candidates preserve explicit, environment, state, default, and owned priority", () => {
  assert.deepEqual(candidatePorts({ explicitPort: 9444, envPort: 9555, statePort: 9666, ownedPorts: [9777, 9223] }), [
    { port: 9444, source: "explicit" }, { port: 9555, source: "environment" }, { port: 9666, source: "state" }, { port: 9223, source: "default" }, { port: 9777, source: "workbuddy-listener" }
  ]);
});

test("renderer URL fallback is accepted only after owner verification", async () => {
  class Session {
    async connect() { return this; }
    async evaluate() { return { url: "file:///renderer/index.html", applicationName: null }; }
    close() {}
  }
  const discoverImpl = async () => [{ id: "one", webSocketDebuggerUrl: "ws://127.0.0.1:9444/devtools/one" }];
  assert.equal((await discoverVerifiedTargets(9444, { discoverImpl, SessionImpl: Session, ownerVerified: false })).length, 0);
  assert.equal((await discoverVerifiedTargets(9444, { discoverImpl, SessionImpl: Session, ownerVerified: true })).length, 1);
});

test("CDP resolution skips a foreign default endpoint and accepts a non-default WorkBuddy port", async () => {
  const listeners = [{ port: 9223, name: "ChatGPT", path: "C:\\ChatGPT.exe" }, { port: 9444, name: "WorkBuddy", path: "C:\\WorkBuddy.exe" }];
  const result = await resolveCdpEndpoint({ listeners, statePort: 9223, verifyImpl: async (port) => ({ ok: port === 9444, port, ownerVerified: port === 9444, reason: port === 9444 ? "workbuddy-renderer-handshake" : "owned-by:ChatGPT" }) });
  assert.equal(result.port, 9444);
  assert.equal(result.source, "workbuddy-listener");
  assert.equal(isWorkBuddyOwner(listeners[0]), false);
  assert.equal(isWorkBuddyOwner(listeners[1]), true);
});

test("automatic discovery ignores unverified ports left in local state", async () => {
  const attempted = [];
  await assert.rejects(() => resolveCdpEndpoint({
    listeners: [],
    savedState: { port: 65534, ownerVerified: false },
    verifyImpl: async (port) => { attempted.push(port); return { ok: false, port, reason: "not found" }; }
  }), /no verified/);
  assert.deepEqual(attempted, [9223]);
});
