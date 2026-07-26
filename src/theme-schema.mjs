import { COLOR, IMAGE_EXTENSIONS, THEME_ID, THEME_SCHEMA_VERSION } from "./constants.mjs";

const defaults = {
  colors: {
    primary: "#7c5cff", secondary: "#35d0ba", background: "#101323", surface: "#171c31",
    text: "#f5f7ff", border: "#303953", error: "#ff6b7a", warning: "#ffbf69", success: "#58e6a8"
  },
  variables: { radius: 12, shadow: "0 18px 40px rgba(0,0,0,.28)", blur: 18, fontSize: 14, lineHeight: 1.5, animation: true, animationSpeed: 1 },
  selectors: { topbar: "header, [data-view-id='titlebar']", sidebar: "aside, [data-view-id='sidebar']", chat: "main, [data-view-id='conversation']", input: "textarea, [contenteditable='true']", code: "pre, code", panel: "[role='dialog'], [data-view-id='panel']" },
  reducedMotion: { enabled: false }
};

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function color(value, key) {
  if (typeof value !== "string" || !COLOR.test(value)) throw new Error(`${key} must be a six-digit hex color`);
  return value.toUpperCase();
}

function boundedNumber(value, key, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}`);
  return value;
}

export function validateThemeManifest(input) {
  if (!record(input)) throw new Error("theme manifest must be an object");
  if (input.schemaVersion !== THEME_SCHEMA_VERSION) throw new Error(`unsupported schemaVersion: ${input.schemaVersion}`);
  if (typeof input.id !== "string" || !THEME_ID.test(input.id)) throw new Error("id must use lowercase letters, numbers, and hyphens");
  if (typeof input.name !== "string" || !input.name.trim()) throw new Error("name must be a non-empty string");
  const colors = { ...defaults.colors, ...(record(input.colors) ? input.colors : {}) };
  for (const [key, value] of Object.entries(colors)) colors[key] = color(value, `colors.${key}`);
  const variables = { ...defaults.variables, ...(record(input.variables) ? input.variables : {}) };
  boundedNumber(Number(variables.radius), "variables.radius", 0, 48);
  boundedNumber(Number(variables.blur), "variables.blur", 0, 80);
  boundedNumber(Number(variables.fontSize), "variables.fontSize", 10, 32);
  boundedNumber(Number(variables.lineHeight), "variables.lineHeight", 1, 2.5);
  boundedNumber(Number(variables.animationSpeed), "variables.animationSpeed", 0.1, 4);
  if (typeof variables.animation !== "boolean") throw new Error("variables.animation must be boolean");
  const selectors = { ...defaults.selectors, ...(record(input.selectors) ? input.selectors : {}) };
  for (const [key, value] of Object.entries(selectors)) if (typeof value !== "string" || !value.trim()) throw new Error(`selectors.${key} must be a selector string`);
  const assets = record(input.assets) ? input.assets : {};
  for (const [key, value] of Object.entries(assets)) {
    if (typeof value !== "string" || !value || value.includes("..") || value.startsWith("/") || value.startsWith("\\")) throw new Error(`assets.${key} must be a safe relative path`);
    const dot = value.lastIndexOf(".");
    if (dot > -1 && !IMAGE_EXTENSIONS.has(value.slice(dot).toLowerCase()) && key !== "font") throw new Error(`assets.${key} has unsupported extension`);
  }
  const reducedMotion = { ...defaults.reducedMotion, ...(record(input.reducedMotion) ? input.reducedMotion : {}) };
  if (typeof reducedMotion.enabled !== "boolean") throw new Error("reducedMotion.enabled must be boolean");
  return {
    schemaVersion: 1, id: input.id, name: input.name.trim(), author: typeof input.author === "string" ? input.author.trim() : "",
    license: typeof input.license === "string" ? input.license : "CC0-1.0", workbuddy: record(input.workbuddy) ? { minVersion: input.workbuddy.minVersion || null, maxVersion: input.workbuddy.maxVersion || null } : { minVersion: null, maxVersion: null },
    colors, variables, selectors, assets, reducedMotion
  };
}

export function defaultTheme(overrides = {}) {
  return validateThemeManifest({ schemaVersion: 1, id: "aurora-night", name: "Aurora Night", ...defaults, ...overrides });
}

export function contrastRatio(foreground, background) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const a = parse(foreground), b = parse(background);
  const l1 = .2126 * a[0] + .7152 * a[1] + .0722 * a[2];
  const l2 = .2126 * b[0] + .7152 * b[1] + .0722 * b[2];
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}

export function checkContrast(theme) {
  const ratio = contrastRatio(theme.colors.text, theme.colors.background);
  return { ratio: Number(ratio.toFixed(2)), level: ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "fail", passesAA: ratio >= 4.5 };
}

export function themeToCss(theme, assetUrl = "") {
  const t = validateThemeManifest(theme); const c = t.colors; const v = t.variables;
  const motion = t.reducedMotion.enabled || !v.animation ? "0ms" : `${Math.round(260 / v.animationSpeed)}ms`;
  const bg = assetUrl ? `background-image: linear-gradient(135deg, color-mix(in srgb, ${c.background} 85%, transparent), ${c.background}dd), url(${JSON.stringify(assetUrl)}); background-size: cover; background-position: center;` : "";
  return `:root[data-wb-theme-forge], body[data-wb-theme-forge] { --cb-bg-primary:${c.background}; --cb-bg-surface:${c.surface}; --cb-text-primary:${c.text}; --cb-accent:${c.primary}; --cb-border:${c.border}; --wb-primary:${c.primary}; --wb-secondary:${c.secondary}; --wb-radius:${v.radius}px; --wb-shadow:${v.shadow}; --wb-blur:${v.blur}px; --wb-font-size:${v.fontSize}px; --wb-line-height:${v.lineHeight}; --wb-transition:${motion}; ${bg} }\n${t.selectors.topbar}{background:color-mix(in srgb, ${c.surface} 88%, transparent)!important;backdrop-filter:blur(var(--wb-blur));}\n${t.selectors.sidebar}{background:color-mix(in srgb, ${c.background} 92%, transparent)!important;border-color:${c.border}!important;}\n${t.selectors.chat}{color:${c.text};font-size:var(--wb-font-size);line-height:var(--wb-line-height);}\n${t.selectors.input}{background:${c.surface}!important;color:${c.text}!important;border:1px solid ${c.border}!important;border-radius:var(--wb-radius)!important;box-shadow:var(--wb-shadow);}\n${t.selectors.code}{background:${c.surface}!important;color:${c.secondary}!important;border-radius:var(--wb-radius);}\n${t.selectors.panel}{background:${c.surface}!important;color:${c.text}!important;border:1px solid ${c.border}!important;border-radius:var(--wb-radius)!important;box-shadow:var(--wb-shadow);}\nbutton,[role=button]{transition:all var(--wb-transition) ease!important;}\n${t.reducedMotion.enabled ? "*{animation:none!important;transition:none!important;scroll-behavior:auto!important;}" : ""}`;
}
