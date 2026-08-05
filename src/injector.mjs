import { createHash } from "node:crypto";
import semver from "semver";
import { STYLE_ID } from "./constants.mjs";
import { adapters, selectAdapter, selectorProbeExpression, diagnoseRegionHits, signatureMatches } from "./adapters.mjs";
import { themeToCss } from "./theme-schema.mjs";
import { inlineCssAssets, loadImageAsset, scopeCustomCss, validateCustomCss } from "./theme-assets.mjs";

const SNAPSHOT_KEY = "wb-theme-forge-appearance-snapshot";

export function inspectExpression() {
  return `(() => { const style=document.getElementById(${JSON.stringify(STYLE_ID)}); const html=document.documentElement,body=document.body; const computed=getComputedStyle(body||html); const applicationName=[html?.dataset?.productName,body?.dataset?.productName,html?.dataset?.applicationName,body?.dataset?.applicationName,document.querySelector('meta[name="application-name"]')?.content,document.title].find(value=>/workbuddy/i.test(value||""))||null; const version=[html?.dataset?.productVersion,body?.dataset?.productVersion,html?.dataset?.version,body?.dataset?.version,document.querySelector('meta[name="application-version"]')?.content].find(Boolean)||null; return {url:location.href,title:document.title,version,identity:{applicationName,rendererPath:/renderer/i.test(location.href),electron:/electron/i.test(navigator.userAgent)},appearance:{htmlClass:html.className,bodyClass:body?.className||"",htmlStyle:html.getAttribute("style"),bodyThemeName:body?.getAttribute("data-vscode-theme-name"),bodyThemeKind:body?.getAttribute("data-vscode-theme-kind")},styles:document.styleSheets.length,injection:style?{themeId:style.dataset.themeId||null,adapterId:style.dataset.adapterId||null,hash:style.dataset.hash||null,bytes:style.textContent.length}:null,variables:Object.fromEntries(${JSON.stringify(["--cb-bg-primary", "--cb-bg-secondary", "--cb-panel-bg-primary", "--cb-text-primary", "--cb-text-secondary", "--cb-text-link", "--cb-text-error-active", "--cb-stroke-secondary", "--cb-vscode-editor-background", "--cb-vscode-sideBar-background", "--cb-vscode-input-background", "--cb-vscode-button-background"])}.map(name=>[name,computed.getPropertyValue(name).trim()]))}; })()`;
}

export async function inspectRenderer(session) { return session.evaluate(inspectExpression()); }

export async function snapshot(session) {
  return session.evaluate(`(() => { const style=document.getElementById(${JSON.stringify(STYLE_ID)}); const html=document.documentElement,body=document.body,current={htmlClass:html.className,bodyClass:body?.className||"",htmlStyle:html.getAttribute("style"),bodyThemeName:body?.getAttribute("data-vscode-theme-name"),bodyThemeKind:body?.getAttribute("data-vscode-theme-kind")}; return {hadStyle:Boolean(style),css:style?.textContent||"",styleData:style?{themeId:style.dataset.themeId||null,adapterId:style.dataset.adapterId||null,hash:style.dataset.hash||null}:null,themeAttr:html.getAttribute("data-wb-theme-forge"),appearance:current,baseAppearance:globalThis[${JSON.stringify(SNAPSHOT_KEY)}]||current}; })()`);
}

export async function compileTheme(theme, adapter) {
  const manifest = theme.manifest || theme;
  let assetUrl = "";
  const backgroundAsset = manifest.assets?.background;
  if (backgroundAsset && theme.dir) assetUrl = (await loadImageAsset(theme.dir, backgroundAsset)).dataUrl;
  let customCss = validateCustomCss(theme.css || "", manifest);
  if (customCss && theme.dir) customCss = await inlineCssAssets(customCss, theme.dir, manifest.assets || {});
  customCss = scopeCustomCss(customCss, manifest.id);
  const css = `${themeToCss(manifest, assetUrl, adapter)}\n${customCss}`;
  return { css, hash: createHash("sha256").update(css).digest("hex"), adapterId: adapter?.id || "unknown" };
}

function appearanceScript(appearance) {
  if (appearance === "auto") return "";
  const remove = appearance === "dark" ? ["light", "cb-light", "vscode-light"] : ["dark", "cb-dark", "vscode-dark"];
  const add = appearance === "dark" ? ["dark", "cb-dark", "vscode-dark"] : ["light", "cb-light", "vscode-light"];
  return `for(const el of [html,body]){if(!el)continue;el.classList.remove(...${JSON.stringify(remove)});el.classList.add(...${JSON.stringify(add)});} body?.setAttribute("data-vscode-theme-kind",${JSON.stringify(appearance === "dark" ? "vscode-dark" : "vscode-light")}); body?.setAttribute("data-vscode-theme-name",${JSON.stringify(appearance === "dark" ? "IDE Dark" : "IDE Light")}); html.style.colorScheme=${JSON.stringify(appearance)};`;
}

export async function preflight(session, manifest, { force = false } = {}) {
  const info = await inspectRenderer(session);
  const resolved = await resolveRendererAdapter(session, info);
  const adapter = resolved.adapter;
  if (!adapter) {
    if (!force) throw new Error(`unsupported WorkBuddy version: ${info.version || "unknown"}; use --force to continue`);
    return { info, adapter: null, diagnosis: resolved.diagnosis, adapterMatchReason: resolved.reason, warnings: ["unknown WorkBuddy version or signature"] };
  }
  const diagnosis = resolved.diagnosis;
  if (!diagnosis.compatible && !force) throw new Error(`adapter ${adapter.id} core selectors did not match; use --force to continue`);
  const current = semver.coerce(info.version)?.version;
  if (current && manifest.workbuddy?.minVersion && semver.lt(current, semver.coerce(manifest.workbuddy.minVersion)?.version || manifest.workbuddy.minVersion) && !force) throw new Error(`theme requires WorkBuddy ${manifest.workbuddy.minVersion} or newer`);
  if (current && manifest.workbuddy?.maxVersion && semver.gt(current, semver.coerce(manifest.workbuddy.maxVersion)?.version || manifest.workbuddy.maxVersion) && !force) throw new Error(`theme supports WorkBuddy up to ${manifest.workbuddy.maxVersion}`);
  const optionalMissing = adapter.optionalRegions.filter((name) => !diagnosis.regions?.[name]?.hit);
  return { info, adapter, diagnosis, adapterMatchReason: resolved.reason, warnings: optionalMissing.length ? [`missing optional regions: ${optionalMissing.join(", ")}`] : [] };
}

export async function resolveRendererAdapter(session, info = null) {
  const renderer = info || await inspectRenderer(session);
  const byVersion = selectAdapter(renderer.version);
  if (byVersion) {
    const regions = await session.evaluate(selectorProbeExpression(byVersion));
    return { adapter: byVersion, diagnosis: diagnoseRegionHits(regions, byVersion), reason: `version:${renderer.version}` };
  }
  let lastDiagnosis = null;
  for (const candidate of adapters.filter((adapter) => adapter.signatureFallback)) {
    const regions = await session.evaluate(selectorProbeExpression(candidate));
    const diagnosis = diagnoseRegionHits(regions, candidate);
    lastDiagnosis = diagnosis;
    if (signatureMatches(renderer, diagnosis, candidate)) return { adapter: candidate, diagnosis, reason: "identity+dom+variables" };
  }
  return { adapter: null, diagnosis: lastDiagnosis, reason: renderer.version ? `unsupported-version:${renderer.version}` : "unknown-signature" };
}

export async function inject(session, theme, { force = false } = {}) {
  const manifest = theme.manifest || theme;
  const checked = await preflight(session, manifest, { force });
  const compiled = await compileTheme(theme, checked.adapter);
  const expression = `(() => { const html=document.documentElement,body=document.body; if(!globalThis[${JSON.stringify(SNAPSHOT_KEY)}]) globalThis[${JSON.stringify(SNAPSHOT_KEY)}]={htmlClass:html.className,bodyClass:body?.className||"",htmlStyle:html.getAttribute("style"),bodyThemeName:body?.getAttribute("data-vscode-theme-name"),bodyThemeKind:body?.getAttribute("data-vscode-theme-kind")}; const base=globalThis[${JSON.stringify(SNAPSHOT_KEY)}];html.className=base.htmlClass;if(body)body.className=base.bodyClass;if(base.htmlStyle===null)html.removeAttribute("style");else html.setAttribute("style",base.htmlStyle);for(const [name,value] of [["data-vscode-theme-name",base.bodyThemeName],["data-vscode-theme-kind",base.bodyThemeKind]]){if(!body)continue;if(value===null)body.removeAttribute(name);else body.setAttribute(name,value);} let el=document.getElementById(${JSON.stringify(STYLE_ID)}); if(!el){el=document.createElement("style");el.id=${JSON.stringify(STYLE_ID)};document.head.appendChild(el);} el.textContent=${JSON.stringify(compiled.css)};el.dataset.themeId=${JSON.stringify(manifest.id)};el.dataset.adapterId=${JSON.stringify(compiled.adapterId)};el.dataset.hash=${JSON.stringify(compiled.hash)};html.setAttribute("data-wb-theme-forge",${JSON.stringify(manifest.id)});${appearanceScript(manifest.appearance)}return{id:el.id,bytes:el.textContent.length,hash:el.dataset.hash,themeId:el.dataset.themeId,adapterId:el.dataset.adapterId}; })()`;
  const applied = await session.evaluate(expression);
  const verified = await inspectRenderer(session);
  if (verified.injection?.hash !== compiled.hash || verified.injection?.themeId !== manifest.id) throw new Error("theme injection verification failed");
  return { ...applied, version: checked.info.version, diagnosis: checked.diagnosis, adapterMatchReason: checked.adapterMatchReason, warnings: checked.warnings };
}

export async function restore(session) {
  return session.evaluate(`(() => { const html=document.documentElement,body=document.body,snapshot=globalThis[${JSON.stringify(SNAPSHOT_KEY)}];document.getElementById(${JSON.stringify(STYLE_ID)})?.remove();html.removeAttribute("data-wb-theme-forge");if(snapshot){html.className=snapshot.htmlClass;if(body)body.className=snapshot.bodyClass;if(snapshot.htmlStyle===null)html.removeAttribute("style");else html.setAttribute("style",snapshot.htmlStyle);for(const [name,value] of [["data-vscode-theme-name",snapshot.bodyThemeName],["data-vscode-theme-kind",snapshot.bodyThemeKind]]){if(!body)continue;if(value===null)body.removeAttribute(name);else body.setAttribute(name,value);}delete globalThis[${JSON.stringify(SNAPSHOT_KEY)}];}return{restored:true};})()`);
}

export async function rollback(session, state) {
  await restore(session);
  if (!state?.hadStyle) return { rolledBack: true, native: true };
  return session.evaluate(`(() => { const html=document.documentElement,body=document.body;let el=document.createElement("style");el.id=${JSON.stringify(STYLE_ID)};el.textContent=${JSON.stringify(state.css || "")};Object.assign(el.dataset,${JSON.stringify(state.styleData || {})});document.head.appendChild(el);if(state.themeAttr===null)html.removeAttribute("data-wb-theme-forge");else html.setAttribute("data-wb-theme-forge",${JSON.stringify(state.themeAttr)});html.className=${JSON.stringify(state.appearance?.htmlClass || "")};if(body)body.className=${JSON.stringify(state.appearance?.bodyClass || "")};if(${JSON.stringify(state.appearance?.htmlStyle ?? null)}===null)html.removeAttribute("style");else html.setAttribute("style",${JSON.stringify(state.appearance?.htmlStyle ?? "")});for(const [name,value] of [["data-vscode-theme-name",${JSON.stringify(state.appearance?.bodyThemeName ?? null)}],["data-vscode-theme-kind",${JSON.stringify(state.appearance?.bodyThemeKind ?? null)}]]){if(!body)continue;if(value===null)body.removeAttribute(name);else body.setAttribute(name,value);}globalThis[${JSON.stringify(SNAPSHOT_KEY)}]=${JSON.stringify(state.baseAppearance || state.appearance || null)};return{rolledBack:true,themeId:el.dataset.themeId||null};})()`);
}
