#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { doctor } from "./diagnostics.mjs";
import { createTheme, deleteTheme, exportTheme, getTheme, importTheme, listThemes, saveTheme } from "./theme-store.mjs";
import { checkContrast, defaultTheme, validateThemeManifest } from "./theme-schema.mjs";
import { CdpSession, discoverTargets } from "./cdp-client.mjs";
import { inject, restore, rollback, snapshot } from "./injector.mjs";
import { readSnapshot, readState, writeSnapshot, writeState } from "./state.mjs";
import { runDaemon } from "./daemon.mjs";

const args = process.argv.slice(2); const command = args[0] || "status"; const json = args.includes("--json");
const value = (name, fallback = null) => { const index = args.indexOf(name); return index > -1 ? args[index + 1] : fallback; };
const output = (result) => { if (json) console.log(JSON.stringify(result, null, 2)); else if (typeof result === "string") console.log(result); else console.log(JSON.stringify(result, null, 2)); };
async function withSession(action) { const port = Number(value("--port", process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT || 9223)); const [target] = await discoverTargets(port); if (!target) throw new Error("No WorkBuddy renderer found. Start WorkBuddy with local CDP enabled."); const session = await new CdpSession(target.webSocketDebuggerUrl).connect(); try { return await action(session, target); } finally { session.close(); } }

try {
  let result;
  if (command === "doctor") result = await doctor({ port: Number(value("--port", 9223)) });
  else if (command === "status") result = { ...(await readState()), doctor: await doctor({ port: Number(value("--port", 9223)) }) };
  else if (command === "list") result = (await listThemes()).map(({ manifest }) => manifest);
  else if (command === "validate") { const file = value("--file", args[1]); if (!file) throw new Error("usage: wb-theme validate <theme.json> or --file <path>"); result = validateThemeManifest(JSON.parse(await readFile(file, "utf8"))); result.contrast = checkContrast(result); }
  else if (command === "apply") { const theme = await getTheme(value("--theme", "aurora-night")); const applied = await withSession(async (session) => { const before = await snapshot(session); await writeSnapshot(before); return inject(session, theme); }); await writeState({ enabled: true, paused: false, themeId: theme.manifest.id, updatedAt: new Date().toISOString() }); result = { ...applied, themeId: theme.manifest.id }; }
  else if (command === "pause" || command === "restore") { result = await withSession(restore); await writeState({ enabled: false, paused: true, themeId: null, updatedAt: new Date().toISOString() }); }
  else if (command === "rollback") { const previous = await readSnapshot(); if (!previous) throw new Error("no snapshot available"); result = await withSession((session) => rollback(session, previous)); }
  else if (command === "create") result = (await createTheme({ image: value("--image"), name: value("--name", "Untitled Theme") })).manifest;
  else if (command === "import") result = (await importTheme(args[1])).manifest;
  else if (command === "export") result = await exportTheme(value("--theme", args[1]), value("--out", `${value("--theme", args[1])}.wbtheme`));
  else if (command === "delete") { await deleteTheme(args[1]); result = { deleted: args[1] }; }
  else if (command === "inspect") result = await withSession((session) => session.evaluate(`({url:location.href,title:document.title,version:document.body?.dataset?.version||null,styles:document.styleSheets.length})`));
  else if (command === "daemon") { output({ started: true, message: "daemon running; press Ctrl+C to stop" }); await runDaemon({ port: Number(value("--port", 9223)) }); process.exit(0); }
  else throw new Error(`unknown command: ${command}`);
  output({ ok: true, result });
} catch (error) { const payload = { ok: false, error: error.message }; if (json) console.error(JSON.stringify(payload, null, 2)); else console.error(`Error: ${error.message}`); process.exitCode = 1; }
