import test from "node:test";
import assert from "node:assert/strict";
import { startControlServer } from "../apps/editor/server.mjs";

test("control server enforces Host and session token", async () => {
  const control = await startControlServer({ requestedPort: 4872, cdpPort: 65534 });
  try {
    const page = await fetch(control.url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /const token=/);
    const denied = await fetch(`${control.url}api/dashboard`, { headers: { "x-wb-theme-token": "wrong" } });
    assert.equal(denied.status, 403);
    const allowed = await fetch(`${control.url}api/dashboard`, { headers: { "x-wb-theme-token": control.token } });
    assert.equal(allowed.status, 200);
  } finally { await control.close(); }
});
