import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { getForgeHome, LOG_FILE } from "./constants.mjs";

export async function logEvent(level, event, details = {}) {
  const home = getForgeHome();
  const file = join(home, LOG_FILE);
  await mkdir(home, { recursive: true });
  try {
    if ((await stat(file)).size > 1024 * 1024) await rename(file, `${file}.1`);
  } catch { /* first log entry */ }
  await appendFile(file, `${JSON.stringify({ time: new Date().toISOString(), level, event, ...details })}\n`);
}
