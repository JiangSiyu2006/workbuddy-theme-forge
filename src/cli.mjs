#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { doctor, diagnoseSession } from "./diagnostics.mjs";
import { createTheme, deleteTheme, duplicateTheme, exportTheme, getTheme, importTheme, listThemes, saveTheme } from "./theme-store.mjs";
import { checkContrast, validateThemeManifest } from "./theme-schema.mjs";
import { readLogs, readState } from "./state.mjs";
import { runDaemon } from "./daemon.mjs";
import { logEvent } from "./logger.mjs";
import { applyTheme, inspectAll, restoreAll, resumeTheme, rollbackAll } from "./runtime.mjs";

const args = process.argv.slice(2);
const command = args[0] || "status";
const json = args.includes("--json");
const value = (name, fallback = null) => { const index = args.indexOf(name); return index > -1 ? args[index + 1] : fallback; };
const output = (result) => console.log(json || typeof result !== "string" ? JSON.stringify(result, null, 2) : result);
const port = () => Number(value("--port", process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT || 9223));

try {
  let result;
  if (command === "doctor") result = await doctor({ port: port() });
  else if (command === "status") result = { ...(await readState()), doctor: await doctor({ port: port() }) };
  else if (command === "list") result = (await listThemes()).map(({ manifest, builtIn }) => ({ ...manifest, builtIn }));
  else if (command === "validate") { const file = value("--file", args[1]); if (!file) throw new Error("usage: wb-theme validate <theme.json>"); result = validateThemeManifest(JSON.parse(await readFile(file, "utf8"))); result.contrast = checkContrast(result); }
  else if (command === "apply") result = await applyTheme(value("--theme", "aurora-night"), { port: port(), force: args.includes("--force") });
  else if (command === "pause") result = await restoreAll({ port: port(), status: "paused", keepTheme: true });
  else if (command === "resume") result = await resumeTheme({ port: port(), force: args.includes("--force") });
  else if (command === "restore") result = await restoreAll({ port: port(), status: "native", keepTheme: false });
  else if (command === "rollback") result = await rollbackAll({ port: port() });
  else if (command === "create") result = (await createTheme({ image: value("--image"), name: value("--name", "Untitled Theme") })).manifest;
  else if (command === "duplicate") result = (await duplicateTheme(args[1], value("--name"))).manifest;
  else if (command === "import") result = (await importTheme(args[1], { conflict: value("--conflict", "reject") })).manifest;
  else if (command === "export") result = await exportTheme(value("--theme", args[1]), value("--out", `${value("--theme", args[1])}.wbtheme`));
  else if (command === "delete") { await deleteTheme(args[1]); result = { deleted: args[1] }; }
  else if (command === "inspect") result = await inspectAll({ port: port() });
  else if (command === "logs") result = await readLogs(value("--tail", 100));
  else if (command === "daemon") { output({ ok: true, result: { started: true, message: "daemon running; press Ctrl+C to stop" } }); await runDaemon({ port: port(), force: args.includes("--force") }); process.exit(0); }
  else if (command === "serve") { const { startControlServer } = await import("../apps/editor/server.mjs"); await startControlServer({ requestedPort: Number(value("--editor-port", 4782)), cdpPort: port(), open: args.includes("--open") }); await new Promise(() => {}); }
  else throw new Error(`unknown command: ${command}`);
  output({ ok: true, result });
} catch (error) {
  const payload = { ok: false, error: error.message };
  await logEvent("error", "cli-command-failed", { command, error: error.message }).catch(() => {});
  if (json) console.error(JSON.stringify(payload, null, 2)); else console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
