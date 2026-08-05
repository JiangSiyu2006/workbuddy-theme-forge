import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { startControlServer } from "../apps/editor/server.mjs";

test("control server enforces Host and session token", async () => {
  const home = join(process.cwd(), ".test-tmp", "control-server");
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(home, { recursive: true, force: true });
  const control = await startControlServer({ requestedPort: 4872, cdpPort: 65534 });
  try {
    const page = await fetch(control.url);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /__WB_THEME_CONFIG__=\{token:"[a-f0-9]{48}"\}/);
    assert.doesNotMatch(html, /__TOKEN__|__NONCE__/);
    assert.match(page.headers.get("content-security-policy"), /script-src 'self' 'nonce-/);
    const app = await fetch(`${control.url}assets/app.mjs`);
    assert.equal(app.status, 200);
    const appScript = await app.text();
    assert.doesNotThrow(() => new Function(appScript.replace(/^import .*;$/m, "")));
    const denied = await fetch(`${control.url}api/dashboard`, { headers: { "x-wb-theme-token": "wrong" } });
    assert.equal(denied.status, 403);
    const allowed = await fetch(`${control.url}api/dashboard`, { headers: { "x-wb-theme-token": control.token } });
    assert.equal(allowed.status, 200);
    assert.equal(Object.hasOwn((await allowed.json()).doctor, "home"), false);
  } finally { await control.close(); await rm(home, { recursive: true, force: true }); }
});
