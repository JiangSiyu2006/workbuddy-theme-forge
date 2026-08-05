import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createThemeFromImage, deleteTheme, duplicateTheme, exportTheme, getTheme, importTheme, listThemes, saveTheme, saveThemeFromSource } from "../src/theme-store.mjs";
import { defaultTheme } from "../src/theme-schema.mjs";

const root = join(process.cwd(), ".test-tmp", "store");
const home = join(root, "home");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=", "base64");

test("protects built-ins and round-trips a compressed image theme", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true });
  assert.ok((await listThemes()).some((theme) => theme.manifest.id === "aurora-dawn"));
  await assert.rejects(() => saveTheme(defaultTheme()), /built-in/);
  await assert.rejects(() => deleteTheme("aurora-night"), /built-in/);
  const created = await createThemeFromImage({ bytes: png, filename: "sample.png", name: "Sample Image" });
  const archive = join(root, "sample.wbtheme");
  await exportTheme(created.manifest.id, archive);
  assert.ok((await readFile(archive)).length > 0);
  await deleteTheme(created.manifest.id);
  const imported = await importTheme(archive);
  assert.equal(imported.manifest.assets.background, "assets/background.png");
  const copy = await duplicateTheme(imported.manifest.id, "Sample Copy");
  assert.equal((await getTheme(copy.manifest.id)).builtIn, false);
  const builtinArchive = join(root, "builtin.wbtheme");
  await exportTheme("aurora-night", builtinArchive);
  const builtinCopy = await importTheme(builtinArchive, { conflict: "copy" });
  assert.notEqual(builtinCopy.manifest.id, "aurora-night");
  await rm(root, { recursive: true, force: true });
});

test("migrates legacy root assets to assets directory", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(root, { recursive: true, force: true }); await mkdir(join(home, "themes", "legacy-image"), { recursive: true });
  const manifest = defaultTheme({ id: "legacy-image", name: "Legacy", assets: { background: "background.png" } });
  await writeFile(join(home, "themes", "legacy-image", "theme.json"), JSON.stringify(manifest));
  await writeFile(join(home, "themes", "legacy-image", "theme.css"), ".hero{background:url(background.png)}");
  await writeFile(join(home, "themes", "legacy-image", "background.png"), png);
  const archive = join(root, "legacy.wbtheme");
  await exportTheme("legacy-image", archive);
  await deleteTheme("legacy-image");
  const imported = await importTheme(archive);
  assert.equal(imported.manifest.assets.background, "assets/background.png");
  assert.match(imported.css, /assets\/background\.png/);
  await rm(root, { recursive: true, force: true });
});

test("saving an edited built-in creates and selects a local copy", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(root, { recursive: true, force: true });
  const source = await getTheme("aurora-night");
  const saved = await saveThemeFromSource(source.manifest.id, { ...source.manifest, name: "Edited Night", colors: { ...source.manifest.colors, primary: "#123456" } }, source.css);
  assert.equal(saved.copiedFromBuiltIn, true);
  assert.notEqual(saved.theme.manifest.id, source.manifest.id);
  assert.equal(saved.theme.builtIn, false);
  assert.equal(saved.theme.manifest.colors.primary, "#123456");
  await rm(root, { recursive: true, force: true });
});

test("saving an unchanged built-in keeps the built-in theme", async () => {
  process.env.WB_THEME_FORGE_HOME = home;
  await rm(root, { recursive: true, force: true });
  const source = await getTheme("aurora-night");
  const saved = await saveThemeFromSource(source.manifest.id, source.manifest, source.css);
  assert.equal(saved.copiedFromBuiltIn, false);
  assert.equal(saved.theme.manifest.id, source.manifest.id);
  assert.equal(saved.theme.builtIn, true);
  await rm(root, { recursive: true, force: true });
});
