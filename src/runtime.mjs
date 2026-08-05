import { CdpSession } from "./cdp-client.mjs";
import { discoverVerifiedTargets } from "./cdp-discovery.mjs";
import { diagnoseSession } from "./diagnostics.mjs";
import { getTheme } from "./theme-store.mjs";
import { inject, restore, rollback, snapshot } from "./injector.mjs";
import { logEvent } from "./logger.mjs";
import { readSnapshot, readState, writeSnapshot, writeState } from "./state.mjs";
import { withOperationLock } from "./operation-lock.mjs";

export async function withRenderers(port, action, { ownerVerified } = {}) {
  const targets = await discoverVerifiedTargets(port, { ownerVerified });
  if (!targets.length) throw new Error("No WorkBuddy renderer found. Start WorkBuddy with local CDP enabled.");
  const results = [];
  for (const target of targets) {
    const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
    try { results.push({ targetId: target.id, ok: true, result: await action(session, target) }); }
    catch (error) { results.push({ targetId: target.id, ok: false, error: error.message }); }
    finally { session.close(); }
  }
  return results;
}

async function requireAll(results, message) {
  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    const error = new Error(`${message}: ${failed.map((item) => `${item.targetId}: ${item.error}`).join("; ")}`);
    error.details = results;
    throw error;
  }
  return results;
}

async function applyThemeUnlocked(themeId, { port = 9223, force = false, ownerVerified } = {}) {
  const theme = await getTheme(themeId);
  const targets = await discoverVerifiedTargets(port, { ownerVerified });
  if (!targets.length) throw new Error("No WorkBuddy renderer found. Start WorkBuddy with local CDP enabled.");
  const sessions = [];
  const previous = [];
  const results = [];
  const applied = [];
  try {
    for (const target of targets) {
      const session = await new CdpSession(target.webSocketDebuggerUrl).connect();
      sessions.push({ target, session });
      previous.push({ targetId: target.id, snapshot: await snapshot(session) });
    }
    await writeSnapshot({ targets: previous, createdAt: new Date().toISOString() });
    for (const { target, session } of sessions) {
      try {
        const result = await inject(session, theme, { force });
        applied.push({ target, session });
        results.push({ targetId: target.id, ok: true, result });
      } catch (error) {
        results.push({ targetId: target.id, ok: false, error: error.message });
        const rollbackResults = [];
        const failedBefore = previous.find((item) => item.targetId === target.id)?.snapshot;
        try { rollbackResults.push({ targetId: target.id, ok: true, result: await rollback(session, failedBefore) }); }
        catch (rollbackError) { rollbackResults.push({ targetId: target.id, ok: false, error: rollbackError.message }); }
        for (const successful of [...applied].reverse()) {
          const before = previous.find((item) => item.targetId === successful.target.id)?.snapshot;
          try { rollbackResults.push({ targetId: successful.target.id, ok: true, result: await rollback(successful.session, before) }); }
          catch (rollbackError) { rollbackResults.push({ targetId: successful.target.id, ok: false, error: rollbackError.message }); }
        }
        const transactionError = new Error(`theme transaction failed on renderer ${target.id}: ${error.message}`);
        transactionError.details = { targets: results, rollback: rollbackResults };
        throw transactionError;
      }
    }
  } finally {
    for (const { session } of sessions) session.close();
  }
  await writeSnapshot({ targets: previous, createdAt: new Date().toISOString() });
  try { await writeState({ status: "active", themeId: theme.manifest.id, port, ownerVerified }); }
  catch (error) {
    const rollbackResults = await withRenderers(port, (session, target) => rollback(session, previous.find((item) => item.targetId === target.id)?.snapshot || previous[0].snapshot), { ownerVerified });
    error.details = { stateWriteFailed: true, rollback: rollbackResults };
    throw error;
  }
  await logEvent("info", "theme-applied", { themeId: theme.manifest.id, targets: results.length });
  return { themeId: theme.manifest.id, targets: results };
}

export function applyTheme(themeId, options = {}) { return withOperationLock(() => applyThemeUnlocked(themeId, options)); }

async function restoreAllUnlocked({ port = 9223, status = "native", keepTheme = false, ownerVerified } = {}) {
  const state = await readState();
  await writeState({ status: "changing", desiredStatus: status, themeId: keepTheme ? state.themeId : null, port, ownerVerified });
  let targets;
  try {
    targets = await withRenderers(port, restore, { ownerVerified });
    await requireAll(targets, "failed to restore one or more renderers");
    await writeState({ status, themeId: keepTheme ? state.themeId : null, port, ownerVerified });
  } catch (error) {
    await writeState(state);
    throw error;
  }
  await logEvent("info", status === "paused" ? "theme-paused" : "theme-restored", { themeId: state.themeId });
  return targets;
}

export function restoreAll(options = {}) { return withOperationLock(() => restoreAllUnlocked(options)); }

async function resumeThemeUnlocked({ port = 9223, force = false, ownerVerified } = {}) {
  const state = await readState();
  if (!state.themeId) throw new Error("no paused theme to resume");
  return applyThemeUnlocked(state.themeId, { port, force, ownerVerified });
}

export function resumeTheme(options = {}) { return withOperationLock(() => resumeThemeUnlocked(options)); }

async function rollbackAllUnlocked({ port = 9223, ownerVerified } = {}) {
  const saved = await readSnapshot();
  if (!saved?.targets?.length) throw new Error("no snapshot available");
  const targets = await withRenderers(port, (session, target) => rollback(session, saved.targets.find((item) => item.targetId === target.id)?.snapshot || saved.targets[0].snapshot), { ownerVerified });
  await requireAll(targets, "failed to roll back one or more renderers");
  const previousThemeId = saved.targets.map((item) => item.snapshot?.styleData?.themeId || item.snapshot?.themeAttr).find(Boolean) || null;
  await writeState({ status: previousThemeId ? "active" : "native", themeId: previousThemeId, port, ownerVerified });
  await logEvent("info", "theme-rolled-back", { targets: targets.length });
  return targets;
}

export function rollbackAll(options = {}) { return withOperationLock(() => rollbackAllUnlocked(options)); }

export async function inspectAll({ port = 9223, ownerVerified } = {}) { return withRenderers(port, diagnoseSession, { ownerVerified }); }
