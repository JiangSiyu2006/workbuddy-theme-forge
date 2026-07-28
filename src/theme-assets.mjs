import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";
import { imageSize } from "image-size";
import * as csstree from "css-tree";
import { IMAGE_EXTENSIONS, MAX_CSS_BYTES, MAX_IMAGE_BYTES } from "./constants.mjs";

const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export function resolveThemeAsset(themeDir, asset) {
  const root = resolve(themeDir);
  const file = resolve(themeDir, normalize(asset));
  if (relative(root, file).startsWith("..") || relative(root, file).includes(":") || file === root) throw new Error("theme asset escapes its directory");
  return file;
}

export async function loadImageAsset(themeDir, asset) {
  const file = resolveThemeAsset(themeDir, asset);
  const ext = extname(file).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) throw new Error("unsupported image extension");
  const bytes = await readFile(file);
  return { file, ...validateImageBytes(bytes, ext) };
}

export function validateImageBytes(bytes, ext) {
  if (!IMAGE_EXTENSIONS.has(ext)) throw new Error("unsupported image extension");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("image must be between 1 byte and 10 MiB");
  let dimensions;
  try { dimensions = imageSize(bytes); } catch { throw new Error("image data does not match a supported format"); }
  if (!dimensions.width || !dimensions.height || dimensions.width > 16384 || dimensions.height > 16384 || dimensions.width * dimensions.height > 50_000_000) throw new Error("image dimensions exceed safety limits");
  return { bytes, dimensions, dataUrl: `data:${mime[ext]};base64,${bytes.toString("base64")}` };
}

export function validateCustomCss(css, { assets = {} } = {}) {
  if (!css?.trim()) return "";
  if (Buffer.byteLength(css) > MAX_CSS_BYTES) throw new Error("theme.css exceeds 256 KiB");
  let ast;
  try { ast = csstree.parse(css, { positions: true }); } catch (error) { throw new Error(`theme.css parse error: ${error.message}`); }
  const allowedAssets = new Set(Object.values(assets).map((asset) => asset.replaceAll("\\", "/")));
  csstree.walk(ast, (node) => {
    if (node.type === "Atrule" && ["import", "font-face", "namespace", "document"].includes(node.name.toLowerCase())) throw new Error(`theme.css @${node.name} is not allowed`);
    if (node.type === "Url") {
      const value = String(node.value || "").replace(/^['"]|['"]$/g, "");
      if (/^(?:https?:|file:|data:|javascript:|vbscript:|\/|\\)/i.test(value) || value.includes("..") || !allowedAssets.has(value)) throw new Error(`theme.css URL is not a declared asset: ${value}`);
    }
  });
  return csstree.generate(ast);
}

export function scopeCustomCss(css, themeId) {
  if (!css) return "";
  const ast = csstree.parse(css);
  csstree.walk(ast, {
    visit: "Rule",
    enter(node) {
      if (node.prelude?.type !== "SelectorList") return;
      const scoped = node.prelude.children.toArray().map((selectorNode) => {
        const selector = csstree.generate(selectorNode).trim();
        if (/^:root\b/.test(selector)) return selector.replace(/^:root/, `html[data-wb-theme-forge="${themeId}"]`);
        if (/^html\b/.test(selector)) return selector.replace(/^html/, `html[data-wb-theme-forge="${themeId}"]`);
        if (/^body\b/.test(selector)) return `html[data-wb-theme-forge="${themeId}"] ${selector}`;
        return `html[data-wb-theme-forge="${themeId}"] ${selector}`;
      }).join(",");
      node.prelude = csstree.parse(scoped, { context: "selectorList" });
    }
  });
  return csstree.generate(ast);
}

export async function inlineCssAssets(css, themeDir, assets) {
  let output = css;
  for (const asset of Object.values(assets)) {
    if (!output.includes(asset)) continue;
    const image = await loadImageAsset(themeDir, asset);
    output = output.split(asset).join(image.dataUrl);
  }
  return output;
}
