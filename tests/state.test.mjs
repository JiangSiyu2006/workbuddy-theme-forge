import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readState, writeState } from "../src/state.mjs";

const home = join(process.cwd(), ".test-tmp", "state");

test("migrates v0.1 state and preserves paused theme", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(home, { recursive: true, force: true }); await mkdir(home, { recursive: true });
  await writeFile(join(home, "state.json"), JSON.stringify({ enabled: false, paused: true, themeId: "aurora-night" }));
  assert.equal((await readState()).status, "paused");
  const saved = await writeState({ status: "paused", themeId: "aurora-night" });
  assert.equal(saved.themeId, "aurora-night"); assert.equal(saved.enabled, false);
  await rm(home, { recursive: true, force: true });
});
