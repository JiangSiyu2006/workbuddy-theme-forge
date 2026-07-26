import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getForgeHome, STATE_FILE, SNAPSHOT_FILE } from "./constants.mjs";
export async function readState() { try { return JSON.parse(await readFile(join(getForgeHome(), STATE_FILE), "utf8")); } catch { return { enabled: false, themeId: null, paused: false }; } }
export async function writeState(value) { await mkdir(getForgeHome(), { recursive: true }); await writeFile(join(getForgeHome(), STATE_FILE), JSON.stringify(value, null, 2)); return value; }
export async function writeSnapshot(value) { await mkdir(join(getForgeHome(), "snapshots"), { recursive: true }); await writeFile(join(getForgeHome(), "snapshots", SNAPSHOT_FILE), JSON.stringify(value, null, 2)); }
export async function readSnapshot() { try { return JSON.parse(await readFile(join(getForgeHome(), "snapshots", SNAPSHOT_FILE), "utf8")); } catch { return null; } }
