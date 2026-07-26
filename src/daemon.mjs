import { discoverTargets, CdpSession } from "./cdp-client.mjs";
import { getTheme } from "./theme-store.mjs";
import { inject } from "./injector.mjs";
import { readState, writeState } from "./state.mjs";
export async function runDaemon({ port = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT) || 9223, intervalMs = 1500, signal } = {}) { let lastTarget = ""; const tick = async () => { const state = await readState(); if (state.paused || !state.themeId) return; try { const [target] = await discoverTargets(port); if (!target || target.id === lastTarget) return; const session = await new CdpSession(target.webSocketDebuggerUrl).connect(); await inject(session, await getTheme(state.themeId)); session.close(); lastTarget = target.id; } catch { /* daemon failures must not affect WorkBuddy */ } }; while (!signal?.aborted) { await tick(); await new Promise((resolve) => setTimeout(resolve, intervalMs)); } return { stopped: true }; }
