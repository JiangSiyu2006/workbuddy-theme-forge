import { existsSync } from "node:fs";
import { join } from "node:path";
import { getForgeHome, DEFAULT_CDP_PORT } from "./constants.mjs";
import { discoverTargets, CdpSession } from "./cdp-client.mjs";
import { inspectRenderer } from "./injector.mjs";
import { selectAdapter, selectorProbeExpression, diagnoseRegionHits } from "./adapters.mjs";

export async function diagnoseSession(session) {
  const renderer = await inspectRenderer(session);
  const adapter = selectAdapter(renderer.version);
  const compatibility = adapter ? diagnoseRegionHits(await session.evaluate(selectorProbeExpression(adapter)), adapter) : null;
  return { renderer, adapter: adapter?.id || null, compatibility };
}

export async function doctor({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || DEFAULT_CDP_PORT } = {}) {
  let cdp = { ok: false, message: "not reachable" };
  try {
    const targets = await discoverTargets(port, { timeoutMs: 900 });
    const renderers = [];
    for (const target of targets) {
      const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
      try { renderers.push({ targetId: target.id, ...(await diagnoseSession(session)) }); } finally { session.close(); }
    }
    cdp = { ok: true, targets: targets.length, renderers };
  } catch (error) { cdp.message = error.message; }
  return { platform: process.platform, node: process.version, port, loopback: true, home: getForgeHome(), homeExists: existsSync(join(getForgeHome(), "themes")), cdp };
}
