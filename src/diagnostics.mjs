import { DEFAULT_CDP_PORT } from "./constants.mjs";
import { CdpSession } from "./cdp-client.mjs";
import { discoverVerifiedTargets } from "./cdp-discovery.mjs";
import { inspectRenderer } from "./injector.mjs";
import { resolveRendererAdapter } from "./injector.mjs";

export async function diagnoseSession(session) {
  const renderer = await inspectRenderer(session);
  const resolved = await resolveRendererAdapter(session, renderer);
  return { renderer, adapter: resolved.adapter?.id || null, adapterMatchReason: resolved.reason, compatibility: resolved.diagnosis };
}

export async function doctor({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || DEFAULT_CDP_PORT, portSource = "explicit", ownerVerified = false, resolutionError = null } = {}) {
  let cdp = { ok: false, endpointReachable: false, rendererCount: 0, message: "not reachable" };
  try {
    const targets = await discoverVerifiedTargets(port, { timeoutMs: 900, ownerVerified });
    const renderers = [];
    for (const target of targets) {
      const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
      try { renderers.push({ targetId: target.id, ...(await diagnoseSession(session)) }); } finally { session.close(); }
    }
    cdp = { ok: renderers.length > 0, endpointReachable: true, rendererCount: renderers.length, targets: targets.length, renderers, adapter: renderers[0]?.adapter || null, adapterMatchReason: renderers[0]?.adapterMatchReason || null, message: renderers.length ? "connected" : "CDP endpoint has no verified WorkBuddy renderer" };
  } catch (error) { cdp.message = error.message; }
  return { platform: process.platform, node: process.version, port, portSource, ownerVerified, resolutionError, loopback: true, cdp };
}
