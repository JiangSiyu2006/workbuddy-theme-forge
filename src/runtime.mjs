import { CdpSession, discoverTargets } from "./cdp-client.mjs";
import { diagnoseSession } from "./diagnostics.mjs";
import { getTheme } from "./theme-store.mjs";
import { inject, restore, rollback, snapshot } from "./injector.mjs";
import { logEvent } from "./logger.mjs";
import { readSnapshot, readState, writeSnapshot, writeState } from "./state.mjs";

export async function withRenderers(port, action) {
  const targets = await discoverTargets(port);
  if (!targets.length) throw new Error("No WorkBuddy renderer found. Start WorkBuddy with local CDP enabled.");
  const results = [];
  for (const target of targets) {
    const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
    try { results.push({ targetId: target.id, ok: true, result: await action(session, target) }); }
    catch (error) { results.push({ targetId: target.id, ok: false, error: error.message }); }
    finally { session.close(); }
  }
  if (!results.some((item) => item.ok)) throw new Error(results.map((item) => item.error).filter(Boolean).join("; ") || "operation failed on all renderers");
  return results;
}

export async function applyTheme(themeId, { port = 9223, force = false } = {}) {
  const theme = await getTheme(themeId);
  const previous = [];
  const targets = await withRenderers(port, async (session, target) => {
    const before = await snapshot(session);
    previous.push({ targetId: target.id, snapshot: before });
    try { return await inject(session, theme, { force }); }
    catch (error) { await rollback(session, before).catch(() => {}); throw error; }
  });
  await writeSnapshot({ targets: previous, createdAt: new Date().toISOString() });
  await writeState({ status: "active", themeId: theme.manifest.id, port });
  await logEvent("info", "theme-applied", { themeId: theme.manifest.id, targets: targets.length });
  return { themeId: theme.manifest.id, targets };
}

export async function restoreAll({ port = 9223, status = "native", keepTheme = false } = {}) {
  const state = await readState();
  const targets = await withRenderers(port, restore);
  await writeState({ status, themeId: keepTheme ? state.themeId : null, port });
  await logEvent("info", status === "paused" ? "theme-paused" : "theme-restored", { themeId: state.themeId });
  return targets;
}

export async function resumeTheme({ port = 9223, force = false } = {}) {
  const state = await readState();
  if (!state.themeId) throw new Error("no paused theme to resume");
  return applyTheme(state.themeId, { port, force });
}

export async function rollbackAll({ port = 9223 } = {}) {
  const saved = await readSnapshot();
  if (!saved?.targets?.length) throw new Error("no snapshot available");
  const targets = await withRenderers(port, (session, target) => rollback(session, saved.targets.find((item) => item.targetId === target.id)?.snapshot || saved.targets[0].snapshot));
  const previousThemeId = saved.targets.map((item) => item.snapshot?.styleData?.themeId || item.snapshot?.themeAttr).find(Boolean) || null;
  await writeState({ status: previousThemeId ? "active" : "native", themeId: previousThemeId, port });
  await logEvent("info", "theme-rolled-back", { targets: targets.length });
  return targets;
}

export async function inspectAll({ port = 9223 } = {}) { return withRenderers(port, diagnoseSession); }
