import { existsSync } from "node:fs";
import { join } from "node:path";
import { getForgeHome, DEFAULT_CDP_PORT } from "./constants.mjs";
import { discoverTargets } from "./cdp-client.mjs";
export async function doctor({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || DEFAULT_CDP_PORT } = {}) { let cdp = { ok: false, message: "not reachable" }; try { const targets = await discoverTargets(port, { timeoutMs: 900 }); cdp = { ok: true, targets: targets.length }; } catch (error) { cdp.message = error.message; } return { platform: process.platform, node: process.version, port, loopback: true, home: getForgeHome(), homeExists: existsSync(join(getForgeHome(), "themes")), cdp }; }
