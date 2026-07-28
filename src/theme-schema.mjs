import { COLOR, IMAGE_EXTENSIONS, THEME_ID, THEME_SCHEMA_VERSION } from "./constants.mjs";

const defaults = {
  appearance: "auto",
  colors: {
    primary: "#6d78d6", secondary: "#54a6a0", background: "#17191f", surface: "#20232b",
    text: "#f2f3f7", border: "#343945", error: "#e66b75", warning: "#d6a34a", success: "#55b887"
  },
  variables: {
    radius: 10, shadow: "0 8px 24px rgba(0,0,0,.18)", blur: 10, fontFamily: "Inter, Segoe UI, sans-serif",
    fontSize: 14, lineHeight: 1.5, animation: true, animationSpeed: 1
  },
  selectors: {
    topbar: ".sidebar-next-main-header, header", sidebar: "[data-view-id='sidebar'], .conversation-sidebar",
    chat: "[data-view-id='main-content'], .teams-main-content, .chat-container", input: "[contenteditable='true'], [role='textbox']",
    code: "pre, code", panel: "[data-view-id$='-panel'], [role='dialog']"
  },
  background: {
    fit: "cover", zoom: 1, positionX: 50, positionY: 50, opacity: 1, blur: 0,
    overlayColor: "#000000", overlayOpacity: 0, vignette: 0
  },
  reducedMotion: { enabled: false }
};

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function color(value, key) {
  if (typeof value !== "string" || !COLOR.test(value)) throw new Error(`${key} must be a six-digit hex color`);
  return value.toUpperCase();
}

function boundedNumber(value, key, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${key} must be between ${min} and ${max}`);
  return number;
}

function safeCssValue(value, key, maxLength = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength || /[{};<>]/.test(value)) throw new Error(`${key} contains an unsafe CSS value`);
  return value.trim();
}

export function validateThemeManifest(input) {
  if (!record(input)) throw new Error("theme manifest must be an object");
  if (input.schemaVersion !== THEME_SCHEMA_VERSION) throw new Error(`unsupported schemaVersion: ${input.schemaVersion}`);
  if (typeof input.id !== "string" || !THEME_ID.test(input.id)) throw new Error("id must use lowercase letters, numbers, and hyphens");
  if (typeof input.name !== "string" || !input.name.trim()) throw new Error("name must be a non-empty string");

  const appearance = input.appearance || defaults.appearance;
  if (!["auto", "light", "dark"].includes(appearance)) throw new Error("appearance must be auto, light, or dark");

  const colors = { ...defaults.colors, ...(record(input.colors) ? input.colors : {}) };
  for (const [key, value] of Object.entries(colors)) colors[key] = color(value, `colors.${key}`);

  const variables = { ...defaults.variables, ...(record(input.variables) ? input.variables : {}) };
  variables.radius = boundedNumber(variables.radius, "variables.radius", 0, 48);
  variables.blur = boundedNumber(variables.blur, "variables.blur", 0, 80);
  variables.fontSize = boundedNumber(variables.fontSize, "variables.fontSize", 10, 32);
  variables.lineHeight = boundedNumber(variables.lineHeight, "variables.lineHeight", 1, 2.5);
  variables.animationSpeed = boundedNumber(variables.animationSpeed, "variables.animationSpeed", 0.1, 4);
  variables.shadow = safeCssValue(variables.shadow, "variables.shadow");
  variables.fontFamily = safeCssValue(variables.fontFamily, "variables.fontFamily");
  if (typeof variables.animation !== "boolean") throw new Error("variables.animation must be boolean");

  const selectors = { ...defaults.selectors, ...(record(input.selectors) ? input.selectors : {}) };
  for (const [key, value] of Object.entries(selectors)) {
    if (typeof value !== "string" || !value.trim() || value.length > 500 || /[{};]/.test(value)) throw new Error(`selectors.${key} must be a safe selector string`);
  }

  const assets = record(input.assets) ? { ...input.assets } : {};
  for (const [key, value] of Object.entries(assets)) {
    if (typeof value !== "string" || !value || value.includes("..") || value.startsWith("/") || value.startsWith("\\") || /^[a-z]+:/i.test(value)) throw new Error(`assets.${key} must be a safe relative path`);
    const dot = value.lastIndexOf(".");
    if (dot < 0 || !IMAGE_EXTENSIONS.has(value.slice(dot).toLowerCase())) throw new Error(`assets.${key} has unsupported extension`);
  }

  const background = { ...defaults.background, ...(record(input.background) ? input.background : {}) };
  if (!["cover", "contain"].includes(background.fit)) throw new Error("background.fit must be cover or contain");
  background.zoom = boundedNumber(background.zoom, "background.zoom", 1, 3);
  background.positionX = boundedNumber(background.positionX, "background.positionX", 0, 100);
  background.positionY = boundedNumber(background.positionY, "background.positionY", 0, 100);
  background.opacity = boundedNumber(background.opacity, "background.opacity", 0, 1);
  background.blur = boundedNumber(background.blur, "background.blur", 0, 40);
  background.overlayColor = color(background.overlayColor, "background.overlayColor");
  background.overlayOpacity = boundedNumber(background.overlayOpacity, "background.overlayOpacity", 0, 1);
  background.vignette = boundedNumber(background.vignette, "background.vignette", 0, 1);

  const reducedMotion = { ...defaults.reducedMotion, ...(record(input.reducedMotion) ? input.reducedMotion : {}) };
  if (typeof reducedMotion.enabled !== "boolean") throw new Error("reducedMotion.enabled must be boolean");

  return {
    schemaVersion: 1, id: input.id, name: input.name.trim(), appearance,
    author: typeof input.author === "string" ? input.author.trim() : "",
    license: typeof input.license === "string" && input.license.trim() ? input.license.trim() : "CC0-1.0",
    workbuddy: record(input.workbuddy) ? { minVersion: input.workbuddy.minVersion || null, maxVersion: input.workbuddy.maxVersion || null } : { minVersion: null, maxVersion: null },
    colors, variables, selectors, assets, background, reducedMotion
  };
}

export function defaultTheme(overrides = {}) {
  return validateThemeManifest({ schemaVersion: 1, id: "aurora-night", name: "Aurora Night", ...defaults, ...overrides });
}

export function contrastRatio(foreground, background) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const [a, b] = [parse(foreground), parse(background)];
  const luminance = (rgb) => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
}

export function checkContrast(theme) {
  const ratio = contrastRatio(theme.colors.text, theme.colors.background);
  return { ratio: Number(ratio.toFixed(2)), level: ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "fail", passesAA: ratio >= 4.5 };
}

export function themeToCss(theme, assetUrl = "") {
  const t = validateThemeManifest(theme); const c = t.colors; const v = t.variables; const b = t.background;
  const motion = t.reducedMotion.enabled || !v.animation ? "0ms" : `${Math.round(220 / v.animationSpeed)}ms`;
  const imageLayer = assetUrl ? `html[data-wb-theme-forge] body{position:relative;isolation:isolate;background:transparent!important;}body::before{content:"";position:fixed;inset:${-b.blur * 2}px;z-index:-2;pointer-events:none;background-image:url(${JSON.stringify(assetUrl)});background-size:${b.fit};background-position:${b.positionX}% ${b.positionY}%;background-repeat:no-repeat;opacity:${b.opacity};filter:blur(${b.blur}px);transform:scale(${b.zoom});}` : "";
  const overlayLayer = assetUrl && (b.overlayOpacity || b.vignette) ? `body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at center,transparent ${Math.round((1-b.vignette)*70)}%,rgba(0,0,0,${b.vignette})),linear-gradient(${c.background}00,${b.overlayColor}${Math.round(b.overlayOpacity*255).toString(16).padStart(2,"0")});}` : "";
  return `html[data-wb-theme-forge]{color-scheme:${t.appearance === "auto" ? "normal" : t.appearance};background:${c.background}!important;}\nhtml[data-wb-theme-forge] body{--cb-bg-primary:${c.background}!important;--cb-bg-surface:${c.surface}!important;--cb-text-primary:${c.text}!important;--cb-accent:${c.primary}!important;--cb-border:${c.border}!important;--cb-vscode-editor-background:${c.background}!important;--wb-primary:${c.primary};--wb-secondary:${c.secondary};--wb-radius:${v.radius}px;--wb-shadow:${v.shadow};--wb-blur:${v.blur}px;--wb-font:${v.fontFamily};--wb-font-size:${v.fontSize}px;--wb-line-height:${v.lineHeight};--wb-transition:${motion};background:${c.background}!important;color:${c.text}!important;font-family:var(--wb-font);}\n${imageLayer}${overlayLayer}\n${t.selectors.topbar}{background:color-mix(in srgb,${c.surface} 94%,transparent)!important;border-color:${c.border}!important;}\n${t.selectors.sidebar}{background:color-mix(in srgb,${c.surface} 97%,transparent)!important;border-color:${c.border}!important;}\n${t.selectors.chat}{background:color-mix(in srgb,${c.background} ${assetUrl ? 78 : 100}%,transparent)!important;color:${c.text};font-size:var(--wb-font-size);line-height:var(--wb-line-height);}\n${t.selectors.input}{background:${c.surface}!important;color:${c.text}!important;border:1px solid ${c.border}!important;border-radius:var(--wb-radius)!important;box-shadow:0 2px 10px rgba(0,0,0,.08)!important;}\n${t.selectors.code}{background:${c.surface}!important;color:${c.secondary}!important;border-radius:calc(var(--wb-radius) - 2px);}\n${t.selectors.panel}{background:${c.surface}!important;color:${c.text}!important;border-color:${c.border}!important;border-radius:var(--wb-radius)!important;box-shadow:var(--wb-shadow)!important;}\nbutton,[role=button]{transition:background-color var(--wb-transition) ease,border-color var(--wb-transition) ease,color var(--wb-transition) ease!important;}\n${t.reducedMotion.enabled ? "*{animation:none!important;transition:none!important;scroll-behavior:auto!important;}" : ""}`;
}
