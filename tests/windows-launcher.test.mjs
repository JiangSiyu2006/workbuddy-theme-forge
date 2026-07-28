import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Windows launcher requires explicit restart confirmation", async () => {
  const script = await readFile("scripts/start-control.ps1", "utf8");
  assert.match(script, /Type YES to confirm/);
  assert.match(script, /if \(\$answer -cne 'YES'\)/);
  assert.doesNotMatch(script, /Stop-Process -Force/);
  assert.match(script, /ValidateRange\(1024,65535\)/);
  assert.match(script, /Get-NetTCPConnection -State Listen/);
});
