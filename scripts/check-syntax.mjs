import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function filesUnder(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else if (entry.isFile() && path.endsWith(".mjs")) output.push(path);
  }
  return output;
}

for (const file of await filesUnder("src").then(async (files) => [
  ...files,
  ...await filesUnder("apps"),
  ...await filesUnder("scripts"),
  ...await filesUnder("tests")
])) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
