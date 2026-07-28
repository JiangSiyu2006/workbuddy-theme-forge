import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getForgeHome, LOG_FILE, SNAPSHOT_FILE, STATE_FILE } from "./constants.mjs";
import { atomicWrite, readJson } from "./files.mjs";

const nativeState = { status: "native", enabled: false, paused: false, themeId: null };

export async function readState() {
  const value = await readJson(join(getForgeHome(), STATE_FILE), nativeState);
  if (value.status) return value;
  return { ...value, status: value.paused ? "paused" : value.enabled ? "active" : "native" };
}

export async function writeState(value) {
  const normalized = {
    ...nativeState,
    ...value,
    enabled: value.status === "active",
    paused: value.status === "paused",
    updatedAt: value.updatedAt || new Date().toISOString()
  };
  await atomicWrite(join(getForgeHome(), STATE_FILE), JSON.stringify(normalized, null, 2));
  return normalized;
}

export async function writeSnapshot(value) {
  await atomicWrite(join(getForgeHome(), "snapshots", SNAPSHOT_FILE), JSON.stringify(value, null, 2));
  return value;
}

export async function readSnapshot() { return readJson(join(getForgeHome(), "snapshots", SNAPSHOT_FILE)); }

export async function readLogs(tail = 100) {
  try {
    const lines = (await readFile(join(getForgeHome(), LOG_FILE), "utf8")).trim().split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, Math.min(1000, Number(tail) || 100))).map((line) => JSON.parse(line));
  } catch { return []; }
}
