import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { basename, extname, join } from "node:path";
import { getForgeHome } from "../../src/constants.mjs";
import { doctor } from "../../src/diagnostics.mjs";
import { createThemeFromImage, deleteTheme, duplicateTheme, exportTheme, getTheme, importTheme, listThemes, saveThemeFromSource } from "../../src/theme-store.mjs";
import { readLogs, readState, writeState } from "../../src/state.mjs";
import { applyTheme, inspectAll, restoreAll, resumeTheme, rollbackAll } from "../../src/runtime.mjs";
import { getDaemonHealth, runDaemon } from "../../src/daemon.mjs";
import { atomicWrite } from "../../src/files.mjs";
import { loadImageAsset } from "../../src/theme-assets.mjs";

const maxBodyBytes = 44 * 1024 * 1024;
const publicRoot = fileURLToPath(new URL("./public", import.meta.url));
const sharedContract = fileURLToPath(new URL("../../src/theme-contract.mjs", import.meta.url));
const staticFiles = new Map([
  ["/assets/styles.css", { file: join(publicRoot, "styles.css"), type: "text/css; charset=utf-8" }],
  ["/assets/app.mjs", { file: join(publicRoot, "app.mjs"), type: "text/javascript; charset=utf-8" }],
  ["/assets/theme-contract.mjs", { file: sharedContract, type: "text/javascript; charset=utf-8" }]
]);

async function bodyJson(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" });
  res.end(JSON.stringify(value));
}

function themeDto(theme) {
  return { manifest: theme.manifest, css: theme.css, source: theme.source, builtIn: theme.builtIn, hasBackground: Boolean(theme.manifest.assets?.background) };
}

async function page(token, nonce) {
  return (await readFile(join(publicRoot, "index.html"), "utf8"))
    .replaceAll("__TOKEN__", JSON.stringify(token))
    .replaceAll("__NONCE__", nonce);
}

function csp(nonce) {
  return `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
}

async function sendStatic(pathname, res) {
  const asset = staticFiles.get(pathname);
  if (!asset) return false;
  res.writeHead(200, { "content-type": asset.type, "cache-control": "no-store", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" });
  res.end(await readFile(asset.file));
  return true;
}

export async function startControlServer({ requestedPort = Number(process.env.WB_THEME_EDITOR_PORT || 4782), cdpPort = Number(process.env.WORKBUDDY_REMOTE_DEBUGGING_PORT || 9223), cdpPortSource = "explicit", ownerVerified = false, open = false } = {}) {
  const token = randomBytes(24).toString("hex");
  const abort = new AbortController();
  let actualPort;
  const server = createServer(async (req, res) => {
    try {
      const expectedHost = `127.0.0.1:${actualPort}`;
      if (req.headers.host !== expectedHost) return json(res, 403, { error: "invalid Host header" });
      const url = new URL(req.url, `http://${expectedHost}`);
      if (await sendStatic(url.pathname, res)) return;
      if (!url.pathname.startsWith("/api/")) {
        const nonce = randomBytes(18).toString("base64");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": csp(nonce), "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" });
        return res.end(await page(token, nonce));
      }
      if (req.headers["x-wb-theme-token"] !== token) return json(res, 403, { error: "invalid session token" });
      const origin = req.headers.origin;
      if (origin && origin !== `http://${expectedHost}`) return json(res, 403, { error: "invalid Origin header" });

      if (url.pathname === "/api/dashboard" && req.method === "GET") return json(res, 200, {
        state: await readState(), themes: (await listThemes()).map(themeDto), doctor: await doctor({ port: cdpPort, portSource: cdpPortSource, ownerVerified }), daemon: getDaemonHealth(), logs: await readLogs(80)
      });
      if (url.pathname === "/api/themes" && req.method === "POST") {
        const input = await bodyJson(req);
        const saved = await saveThemeFromSource(input.sourceThemeId, input.manifest, input.css || "");
        return json(res, 200, { ok: true, theme: themeDto(saved.theme), copiedFromBuiltIn: saved.copiedFromBuiltIn });
      }

      const match = url.pathname.match(/^\/api\/themes\/([a-z0-9-]+)(?:\/(duplicate|export|background))?$/);
      if (match && req.method === "DELETE" && !match[2]) { await deleteTheme(match[1]); return json(res, 200, { ok: true }); }
      if (match?.[2] === "duplicate" && req.method === "POST") { const input = await bodyJson(req); return json(res, 200, { ok: true, theme: themeDto(await duplicateTheme(match[1], input.name)) }); }
      if (match?.[2] === "background" && req.method === "GET") {
        const theme = await getTheme(match[1]);
        const asset = theme.manifest.assets?.background;
        if (!asset) return json(res, 404, { error: "theme has no background" });
        const image = await loadImageAsset(theme.dir, asset);
        const type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(image.file).toLowerCase()];
        res.writeHead(200, { "content-type": type, "cache-control": "no-store", "content-security-policy": "default-src 'none'", "x-content-type-options": "nosniff" });
        return res.end(image.bytes);
      }
      if (match?.[2] === "export" && req.method === "GET") {
        const out = join(getForgeHome(), "exports", `${match[1]}-${randomBytes(6).toString("hex")}.wbtheme`);
        try {
          await exportTheme(match[1], out);
          const bytes = await readFile(out);
          res.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": `attachment; filename=${match[1]}.wbtheme`, "cache-control": "no-store" });
          return res.end(bytes);
        } finally { await rm(out, { force: true }).catch(() => {}); }
      }
      if (url.pathname === "/api/import" && req.method === "POST") {
        const input = await bodyJson(req);
        const file = join(getForgeHome(), "imports", `${randomBytes(6).toString("hex")}-${basename(input.name || "theme.wbtheme")}`);
        try {
          await atomicWrite(file, Buffer.from(input.data, "base64"));
          return json(res, 200, { ok: true, theme: themeDto(await importTheme(file, { conflict: input.conflict || "reject" })) });
        } finally { await rm(file, { force: true }).catch(() => {}); }
      }
      if (url.pathname === "/api/create-image" && req.method === "POST") {
        const input = await bodyJson(req);
        return json(res, 200, { ok: true, theme: themeDto(await createThemeFromImage({ bytes: Buffer.from(input.data, "base64"), filename: basename(input.filename), name: input.name })) });
      }

      const action = url.pathname.match(/^\/api\/actions\/(apply|pause|resume|restore|rollback|inspect)$/)?.[1];
      if (action && req.method === "POST") {
        const input = await bodyJson(req);
        const options = { port: cdpPort, force: Boolean(input.force), ownerVerified };
        let result; let themeId; let copiedFromBuiltIn = false;
        if (action === "apply") {
          themeId = input.themeId;
          if (input.draft) {
            const saved = await saveThemeFromSource(input.draft.sourceThemeId, input.draft.manifest, input.draft.css || "");
            themeId = saved.theme.manifest.id;
            copiedFromBuiltIn = saved.copiedFromBuiltIn;
          }
          if (!input.draft && !themeId) throw new Error("themeId is required");
          result = await applyTheme(themeId, options);
        } else if (action === "pause") result = await restoreAll({ ...options, status: "paused", keepTheme: true });
        else if (action === "resume") result = await resumeTheme(options);
        else if (action === "restore") result = await restoreAll({ ...options, status: "native", keepTheme: false });
        else if (action === "rollback") result = await rollbackAll(options);
        else result = await inspectAll(options);
        return json(res, 200, { ok: true, result, themeId, copiedFromBuiltIn });
      }
      return json(res, 404, { error: "not found" });
    } catch (error) { json(res, 400, { error: error.message, details: error.details }); }
  });

  for (let candidate = requestedPort; candidate < requestedPort + 10; candidate++) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => { server.off("listening", onListen); reject(error); };
        const onListen = () => { server.off("error", onError); resolve(); };
        server.once("error", onError); server.once("listening", onListen); server.listen(candidate, "127.0.0.1");
      });
      actualPort = candidate; break;
    } catch (error) { if (error.code !== "EADDRINUSE") throw error; }
  }
  if (!actualPort) throw new Error("no available control server port");
  if (ownerVerified) {
    const currentState = await readState();
    await writeState({ ...currentState, port: cdpPort, portSource: cdpPortSource, ownerVerified, updatedAt: new Date().toISOString() });
  }
  runDaemon({ port: cdpPort, ownerVerified, signal: abort.signal }).catch((error) => { console.error(`Theme daemon stopped: ${error.message}`); });
  const url = `http://127.0.0.1:${actualPort}/`;
  console.log(`Theme control: ${url}`);
  if (open && process.platform === "win32") {
    const { spawn } = await import("node:child_process");
    spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
  server.on("close", () => abort.abort());
  return { server, url, token, close: () => new Promise((resolve) => server.close(resolve)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startControlServer({ open: process.argv.includes("--open") });
