import { discoverTargets, CdpSession } from "./cdp-client.mjs";
import { getTheme } from "./theme-store.mjs";
import { compileTheme, inject, inspectRenderer } from "./injector.mjs";
import { readState } from "./state.mjs";
import { logEvent } from "./logger.mjs";
import { selectAdapter } from "./adapters.mjs";

export async function daemonTick({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || 9223, force = false } = {}) {
  const state = await readState();
  if (state.status !== "active" || !state.themeId) return { skipped: true, status: state.status };
  const theme = await getTheme(state.themeId);
  const targets = await discoverTargets(port);
  const results = [];
  for (const target of targets) {
    const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
    try {
      const current = await inspectRenderer(session);
      const expected = await compileTheme(theme, selectAdapter(current.version));
      if (current.injection?.hash === expected.hash && current.injection?.themeId === theme.manifest.id) results.push({ targetId: target.id, healthy: true });
      else results.push({ targetId: target.id, reinjected: true, result: await inject(session, theme, { force }) });
    } catch (error) {
      results.push({ targetId: target.id, error: error.message });
      await logEvent("error", "daemon-target-failed", { targetId: target.id, error: error.message });
    } finally { session.close(); }
  }
  return { skipped: false, results };
}

export async function runDaemon({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || 9223, intervalMs = 1500, signal, force = false } = {}) {
  let failures = 0;
  await logEvent("info", "daemon-started", { port });
  while (!signal?.aborted) {
    try { await daemonTick({ port, force }); failures = 0; }
    catch (error) { failures++; await logEvent("error", "daemon-tick-failed", { error: error.message, failures }); }
    const delay = Math.min(intervalMs * 2 ** Math.min(failures, 4), 15000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  await logEvent("info", "daemon-stopped", { port });
  return { stopped: true };
}
