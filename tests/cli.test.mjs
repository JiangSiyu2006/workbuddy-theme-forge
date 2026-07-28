import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

test("CLI list keeps a machine-readable JSON contract", async () => {
  const { stdout } = await exec(process.execPath, ["src/cli.mjs", "list", "--json"], { cwd: process.cwd(), env: { ...process.env, WB_THEME_FORGE_HOME: `${process.cwd()}\\.test-tmp\\cli` } });
  const output = JSON.parse(stdout);
  assert.equal(output.ok, true);
  assert.ok(output.result.some((theme) => theme.id === "aurora-night" && theme.builtIn));
});
