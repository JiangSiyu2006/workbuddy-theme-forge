import { CdpSession } from "./cdp-client.mjs";
import { discoverVerifiedTargets } from "./cdp-discovery.mjs";
import { getTheme } from "./theme-store.mjs";
import { compileTheme, inject, inspectRenderer, resolveRendererAdapter } from "./injector.mjs";
import { readState } from "./state.mjs";
import { logEvent } from "./logger.mjs";
import { withOperationLock } from "./operation-lock.mjs";

const health = { running: false, port: null, lastSuccessAt: null, consecutiveFailures: 0, lastError: null };

export function getDaemonHealth() { return { ...health }; }

async function daemonTickUnlocked({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || 9223, force = false, ownerVerified } = {}) {
  const state = await readState();
  if (state.status !== "active" || !state.themeId) return { skipped: true, status: state.status };
  const theme = await getTheme(state.themeId);
  const targets = await discoverVerifiedTargets(port, { ownerVerified });
  if (!targets.length) throw new Error("no WorkBuddy renderer found");
  const results = [];
  for (const target of targets) {
    const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
    try {
      const current = await inspectRenderer(session);
      const resolved = await resolveRendererAdapter(session, current);
      if (!resolved.adapter && !force) throw new Error(`no compatible adapter: ${resolved.reason}`);
      const expected = await compileTheme(theme, resolved.adapter);
      if (current.injection?.hash === expected.hash && current.injection?.themeId === theme.manifest.id) results.push({ targetId: target.id, healthy: true });
      else results.push({ targetId: target.id, reinjected: true, result: await inject(session, theme, { force }) });
    } catch (error) {
      results.push({ targetId: target.id, error: error.message });
      await logEvent("error", "daemon-target-failed", { targetId: target.id, error: error.message });
    } finally { session.close(); }
  }
  const failed = results.filter((item) => item.error);
  if (failed.length) {
    const error = new Error(`daemon failed on ${failed.length} renderer(s)`);
    error.details = results;
    throw error;
  }
  return { skipped: false, results };
}

export function daemonTick(options = {}) { return withOperationLock(() => daemonTickUnlocked(options)); }

export async function runDaemon({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || 9223, intervalMs = 1500, signal, force = false, ownerVerified } = {}) {
  let failures = 0;
  Object.assign(health, { running: true, port, consecutiveFailures: 0, lastError: null });
  await logEvent("info", "daemon-started", { port });
  while (!signal?.aborted) {
    try {
      await daemonTick({ port, force, ownerVerified });
      failures = 0;
      Object.assign(health, { lastSuccessAt: new Date().toISOString(), consecutiveFailures: 0, lastError: null });
    } catch (error) {
      failures++;
      Object.assign(health, { consecutiveFailures: failures, lastError: error.message });
      await logEvent("error", "daemon-tick-failed", { error: error.message, failures });
    }
    const delay = Math.min(intervalMs * 2 ** Math.min(failures, 4), 15000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  health.running = false;
  await logEvent("info", "daemon-stopped", { port });
  return { stopped: true };
}
