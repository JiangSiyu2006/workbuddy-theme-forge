import { createReadStream } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import yauzl from "yauzl";
import yazl from "yazl";
import { getForgeHome, MAX_EXPANDED_BYTES, MAX_PACKAGE_BYTES, MAX_PACKAGE_ENTRIES, THEME_ID } from "./constants.mjs";
import { atomicWrite } from "./files.mjs";
import { defaultTheme, validateThemeManifest, themeToCss } from "./theme-schema.mjs";
import { loadImageAsset, validateCustomCss, validateImageBytes } from "./theme-assets.mjs";

const builtinRoot = fileURLToPath(new URL("../themes", import.meta.url));
const openZip = promisify(yauzl.fromBuffer);

async function ensureDirs() {
  const home = getForgeHome();
  await mkdir(join(home, "themes"), { recursive: true });
  await mkdir(join(home, "snapshots"), { recursive: true });
  return home;
}

function isWithin(root, path) {
  const value = relative(resolve(root), resolve(path));
  return value && !value.startsWith("..") && !value.includes(":");
}

function assertThemeId(id) {
  if (typeof id !== "string" || !THEME_ID.test(id)) throw new Error("invalid theme id");
}

async function readThemeDir(dir, source) {
  const manifest = validateThemeManifest(JSON.parse(await readFile(join(dir, "theme.json"), "utf8")));
  const css = await readFile(join(dir, "theme.css"), "utf8").catch(() => "");
  validateCustomCss(css, manifest);
  for (const asset of Object.values(manifest.assets)) await loadImageAsset(dir, asset);
  return { manifest, dir, css, source, builtIn: source === "builtin" };
}

async function scanRoot(root, source) {
  const themes = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || !THEME_ID.test(entry.name)) continue;
    try { themes.push(await readThemeDir(join(root, entry.name), source)); } catch { /* malformed themes are excluded */ }
  }
  return themes;
}

export async function listThemes() {
  const home = await ensureDirs();
  const builtins = await scanRoot(builtinRoot, "builtin");
  const users = await scanRoot(join(home, "themes"), "user");
  return [...builtins, ...users].filter((theme, index, all) => all.findIndex((item) => item.manifest.id === theme.manifest.id) === index);
}

export async function getTheme(id) {
  assertThemeId(id);
  const theme = (await listThemes()).find((item) => item.manifest.id === id);
  if (!theme) throw new Error(`theme not found: ${id}`);
  return theme;
}

function userThemeDir(home, id) {
  assertThemeId(id);
  const dir = join(home, "themes", id);
  if (!isWithin(join(home, "themes"), dir)) throw new Error("unsafe theme path");
  return dir;
}

async function writeTheme(dir, manifest, css) {
  await mkdir(dir, { recursive: true });
  await atomicWrite(join(dir, "theme.json"), JSON.stringify(manifest, null, 2));
  await atomicWrite(join(dir, "theme.css"), css || "");
}

async function commitThemeDirectory(finalDir, populate) {
  const parent = dirname(finalDir);
  const stage = join(parent, `.${basename(finalDir)}-${randomUUID()}.tmp`);
  const backup = join(parent, `.${basename(finalDir)}-${randomUUID()}.bak`);
  await mkdir(parent, { recursive: true });
  let movedExisting = false;
  try {
    await mkdir(stage, { recursive: true });
    await populate(stage);
    await readThemeDir(stage, "user");
    if (await stat(finalDir).then(() => true).catch(() => false)) { await rename(finalDir, backup); movedExisting = true; }
    await rename(stage, finalDir);
    if (movedExisting) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(stage, { recursive: true, force: true }).catch(() => {});
    if (movedExisting) {
      await rm(finalDir, { recursive: true, force: true }).catch(() => {});
      await rename(backup, finalDir).catch(() => {});
    }
    throw error;
  }
}

function normalizedAssetPath(asset) {
  const normalized = asset.replaceAll("\\", "/");
  return normalized.startsWith("assets/") ? normalized : `assets/${basename(normalized)}`;
}

function normalizeManifestAssets(manifest) {
  return validateThemeManifest({ ...manifest, assets: Object.fromEntries(Object.entries(manifest.assets).map(([key, asset]) => [key, normalizedAssetPath(asset)])) });
}

function remapCssAssets(css, sourceAssets, targetAssets) {
  let output = css;
  for (const [key, source] of Object.entries(sourceAssets)) output = output.split(source).join(targetAssets[key]);
  return output;
}

export async function saveTheme(manifest, css = "", { allowReplace = true } = {}) {
  let normalized = validateThemeManifest(manifest);
  if ((await scanRoot(builtinRoot, "builtin")).some((theme) => theme.manifest.id === normalized.id)) throw new Error("built-in themes must be saved as a copy");
  validateCustomCss(css, normalized);
  const home = await ensureDirs();
  const dir = userThemeDir(home, normalized.id);
  if (!allowReplace && await stat(dir).then(() => true).catch(() => false)) throw new Error(`theme already exists: ${normalized.id}`);
  const previous = await readThemeDir(dir, "user").catch(() => null);
  const originalAssets = normalized.assets;
  normalized = normalizeManifestAssets(normalized);
  const normalizedCss = remapCssAssets(css, originalAssets, normalized.assets);
  await commitThemeDirectory(dir, async (stage) => {
    await writeTheme(stage, normalized, normalizedCss);
    for (const [key, targetAsset] of Object.entries(normalized.assets)) {
      const sourceAsset = originalAssets[key];
      if (!previous) throw new Error(`missing existing asset: ${sourceAsset}`);
      const target = join(stage, targetAsset); await mkdir(dirname(target), { recursive: true });
      await cp(join(previous.dir, sourceAsset), target);
    }
  });
  return readThemeDir(dir, "user");
}

export async function saveThemeFromSource(sourceThemeId, manifest, css = "") {
  const source = await getTheme(sourceThemeId);
  const input = validateThemeManifest(manifest);
  if (input.id !== source.manifest.id) throw new Error("theme id cannot be changed while editing");
  if (!source.builtIn) return { theme: await saveTheme(input, css), copiedFromBuiltIn: false };

  const normalizedCss = validateCustomCss(css, input);
  const unchanged = JSON.stringify(input) === JSON.stringify(source.manifest) && normalizedCss === validateCustomCss(source.css, source.manifest);
  if (unchanged) return { theme: source, copiedFromBuiltIn: false };

  const id = await uniqueId(`${source.manifest.id}-custom`);
  const name = input.name === source.manifest.name ? `${input.name} Copy` : input.name;
  const originalManifest = validateThemeManifest({ ...input, id, name });
  const normalized = normalizeManifestAssets(originalManifest);
  const copiedCss = remapCssAssets(normalizedCss, originalManifest.assets, normalized.assets);
  validateCustomCss(copiedCss, normalized);
  const home = await ensureDirs();
  const dir = userThemeDir(home, id);
  await commitThemeDirectory(dir, async (stage) => {
    await writeTheme(stage, normalized, copiedCss);
    for (const [key, asset] of Object.entries(normalized.assets)) {
      const sourceAsset = source.manifest.assets[key];
      if (!sourceAsset) throw new Error(`missing source asset: ${key}`);
      const target = join(stage, asset);
      await mkdir(dirname(target), { recursive: true });
      await atomicWrite(target, await readFile(join(source.dir, sourceAsset)));
    }
  });
  return { theme: await readThemeDir(dir, "user"), copiedFromBuiltIn: true };
}

export async function deleteTheme(id) {
  assertThemeId(id);
  if ((await scanRoot(builtinRoot, "builtin")).some((theme) => theme.manifest.id === id)) throw new Error("built-in themes cannot be deleted");
  const home = await ensureDirs();
  const dir = userThemeDir(home, id);
  await rm(dir, { recursive: true, force: false });
}

function slug(name) {
  return String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `theme-${Date.now()}`;
}

async function uniqueId(base) {
  const ids = new Set((await listThemes()).map((theme) => theme.manifest.id));
  if (!ids.has(base)) return base;
  for (let index = 2; index < 1000; index++) if (!ids.has(`${base}-${index}`)) return `${base}-${index}`;
  throw new Error("unable to allocate a unique theme id");
}

export async function createTheme({ image, name }) {
  if (!image) throw new Error("create requires --image <path>");
  const ext = extname(image).toLowerCase();
  const id = await uniqueId(slug(name));
  const asset = `assets/background${ext}`;
  const manifest = defaultTheme({ id, name: name || "Untitled Theme", assets: { background: asset }, background: { ...defaultTheme().background, overlayOpacity: .2, vignette: .15 } });
  await loadImageAsset(dirname(image), basename(image));
  const home = await ensureDirs();
  const dir = userThemeDir(home, id);
  await commitThemeDirectory(dir, async (stage) => {
    await writeTheme(stage, manifest, "");
    await mkdir(join(stage, "assets"), { recursive: true });
    await atomicWrite(join(stage, asset), await readFile(image));
  });
  return readThemeDir(dir, "user");
}

export async function createThemeFromImage({ bytes, filename, name }) {
  const ext = extname(filename || "").toLowerCase();
  validateImageBytes(bytes, ext);
  const id = await uniqueId(slug(name));
  const asset = `assets/background${ext}`;
  const manifest = defaultTheme({ id, name: name || "Untitled Theme", assets: { background: asset }, background: { ...defaultTheme().background, overlayOpacity: .2, vignette: .15 } });
  const home = await ensureDirs();
  const dir = userThemeDir(home, id);
  await commitThemeDirectory(dir, async (stage) => {
    await writeTheme(stage, manifest, "");
    await mkdir(join(stage, "assets"), { recursive: true });
    await atomicWrite(join(stage, asset), bytes);
  });
  return readThemeDir(dir, "user");
}

export async function duplicateTheme(id, name) {
  const source = await getTheme(id);
  const copyId = await uniqueId(slug(name || `${source.manifest.name} Copy`));
  const originalManifest = validateThemeManifest({ ...source.manifest, id: copyId, name: name || `${source.manifest.name} Copy` });
  const manifest = normalizeManifestAssets(originalManifest);
  const home = await ensureDirs();
  const dir = userThemeDir(home, copyId);
  const normalizedCss = remapCssAssets(source.css, source.manifest.assets, manifest.assets);
  await commitThemeDirectory(dir, async (stage) => {
    await writeTheme(stage, manifest, normalizedCss);
    for (const [key, asset] of Object.entries(manifest.assets)) {
      const target = join(stage, asset);
      await mkdir(dirname(target), { recursive: true });
      await atomicWrite(target, await readFile(join(source.dir, source.manifest.assets[key])));
    }
  });
  return readThemeDir(dir, "user");
}

function safeArchiveName(name) {
  const normalized = name.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || normalized.split("/").includes("..") || normalized.includes("\0")) throw new Error("theme package contains an unsafe path");
  return normalized;
}

function readEntry(zip, entry) {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => {
    if (error) return reject(error);
    const chunks = []; let size = 0;
    stream.on("data", (chunk) => { size += chunk.length; if (size > MAX_EXPANDED_BYTES) stream.destroy(new Error("theme package expands beyond 64 MiB")); else chunks.push(chunk); });
    stream.on("error", reject); stream.on("end", () => resolve(Buffer.concat(chunks)));
  }));
}

async function unzip(buffer) {
  if (!buffer.length || buffer.length > MAX_PACKAGE_BYTES) throw new Error("theme package must be between 1 byte and 32 MiB");
  const zip = await openZip(buffer, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: true });
  const entries = new Map(); let expanded = 0; let count = 0;
  return new Promise((resolveEntries, reject) => {
    const fail = (error) => { try { zip.close(); } catch {} reject(error); };
    zip.on("error", fail);
    zip.on("entry", async (entry) => {
      try {
        count++;
        if (count > MAX_PACKAGE_ENTRIES) throw new Error("theme package contains more than 64 entries");
        const name = safeArchiveName(entry.fileName);
        const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
        if ((unixMode & 0o170000) === 0o120000) throw new Error("theme package links are not allowed");
        if (name.endsWith("/")) return zip.readEntry();
        if (entries.has(name.toLowerCase())) throw new Error(`duplicate theme package entry: ${name}`);
        if (/\.(?:zip|wbtheme)$/i.test(name)) throw new Error("nested archives are not allowed");
        const data = await readEntry(zip, entry);
        expanded += data.length;
        if (expanded > MAX_EXPANDED_BYTES) throw new Error("theme package expands beyond 64 MiB");
        entries.set(name.toLowerCase(), { name, data });
        zip.readEntry();
      } catch (error) { fail(error); }
    });
    zip.on("end", () => resolveEntries(entries));
    zip.readEntry();
  });
}

function zipBuffer(entries) {
  return new Promise((resolveBuffer, reject) => {
    const zip = new yazl.ZipFile(); const chunks = [];
    zip.outputStream.on("data", (chunk) => chunks.push(chunk));
    zip.outputStream.on("error", reject);
    zip.outputStream.on("end", () => resolveBuffer(Buffer.concat(chunks)));
    for (const [name, data] of entries) zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), safeArchiveName(name), { compress: true });
    zip.end();
  });
}

export async function exportTheme(id, outFile) {
  const theme = await getTheme(id);
  const manifest = normalizeManifestAssets(theme.manifest);
  const css = remapCssAssets(theme.css, theme.manifest.assets, manifest.assets);
  const entries = [["theme.json", JSON.stringify(manifest, null, 2)], ["theme.css", css], ["LICENSE", manifest.license]];
  for (const [key, asset] of Object.entries(manifest.assets)) entries.push([asset, await readFile(join(theme.dir, theme.manifest.assets[key]))]);
  await atomicWrite(outFile, await zipBuffer(entries));
  return outFile;
}

function validatePackageFiles(entries, manifest) {
  const allowed = new Set(["theme.json", "theme.css", "license", "preview.png", ...Object.values(manifest.assets).map((asset) => asset.toLowerCase().replaceAll("\\", "/"))]);
  for (const entry of entries.values()) if (!allowed.has(entry.name.toLowerCase())) throw new Error(`unregistered package file: ${entry.name}`);
  for (const asset of Object.values(manifest.assets)) if (!entries.has(asset.toLowerCase().replaceAll("\\", "/"))) throw new Error(`theme package missing asset: ${asset}`);
}

export async function importTheme(file, { conflict = "reject" } = {}) {
  const entries = await unzip(await readFile(file));
  const themeEntry = entries.get("theme.json");
  if (!themeEntry) throw new Error("theme package missing theme.json");
  const packageManifest = validateThemeManifest(JSON.parse(themeEntry.data.toString("utf8")));
  validatePackageFiles(entries, packageManifest);
  let manifest = normalizeManifestAssets(packageManifest);
  const packageCss = entries.get("theme.css")?.data.toString("utf8") || "";
  validateCustomCss(packageCss, packageManifest);
  const css = remapCssAssets(packageCss, packageManifest.assets, manifest.assets);
  for (const asset of Object.values(packageManifest.assets)) validateImageBytes(entries.get(asset.toLowerCase().replaceAll("\\", "/")).data, extname(asset).toLowerCase());
  const existing = (await listThemes()).find((theme) => theme.manifest.id === manifest.id);
  if (existing?.builtIn && conflict !== "copy") throw new Error("theme package conflicts with a built-in theme; import it as a copy");
  if (existing && conflict === "reject") throw new Error(`theme already exists: ${manifest.id}`);
  if (existing && conflict === "copy") manifest = validateThemeManifest({ ...manifest, id: await uniqueId(manifest.id), name: `${manifest.name} Copy` });
  if (existing && conflict !== "replace" && conflict !== "copy") throw new Error("conflict must be reject, copy, or replace");
  const home = await ensureDirs();
  const dir = userThemeDir(home, manifest.id);
  await commitThemeDirectory(dir, async (stage) => {
    await writeTheme(stage, manifest, css);
    for (const [key, asset] of Object.entries(manifest.assets)) {
      const sourceAsset = packageManifest.assets[key];
      const entry = entries.get(sourceAsset.toLowerCase().replaceAll("\\", "/"));
      const target = join(stage, asset);
      await mkdir(dirname(target), { recursive: true });
      await atomicWrite(target, entry.data);
    }
  });
  return readThemeDir(dir, "user");
}

export { MAX_PACKAGE_BYTES as maxPackageBytes };
