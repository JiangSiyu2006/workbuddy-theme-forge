import { createHash } from "node:crypto";
import semver from "semver";
import { STYLE_ID } from "./constants.mjs";
import { selectAdapter, selectorProbeExpression, diagnoseRegionHits } from "./adapters.mjs";
import { themeToCss } from "./theme-schema.mjs";
import { inlineCssAssets, loadImageAsset, scopeCustomCss, validateCustomCss } from "./theme-assets.mjs";

const SNAPSHOT_KEY = "wb-theme-forge-appearance-snapshot";

export function inspectExpression() {
  return `(() => { const style=document.getElementById(${JSON.stringify(STYLE_ID)}); const body=document.body; const computed=getComputedStyle(body||document.documentElement); return {url:location.href,title:document.title,version:body?.dataset?.productVersion||null,appearance:{htmlClass:document.documentElement.className,bodyClass:body?.className||"",htmlStyle:document.documentElement.getAttribute("style"),bodyThemeName:body?.getAttribute("data-vscode-theme-name"),bodyThemeKind:body?.getAttribute("data-vscode-theme-kind")},styles:document.styleSheets.length,injection:style?{themeId:style.dataset.themeId||null,adapterId:style.dataset.adapterId||null,hash:style.dataset.hash||null,bytes:style.textContent.length}:null,variables:Object.fromEntries(${JSON.stringify(["--cb-bg-primary", "--cb-bg-surface", "--cb-text-primary", "--cb-accent", "--cb-border", "--cb-vscode-editor-background"])}.map(name=>[name,computed.getPropertyValue(name).trim()]))}; })()`;
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
  const css = `${themeToCss(manifest, assetUrl)}\n${customCss}`;
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
  const adapter = selectAdapter(info.version);
  if (!adapter) {
    if (!force) throw new Error(`unsupported WorkBuddy version: ${info.version || "unknown"}; use --force to continue`);
    return { info, adapter: null, diagnosis: null, warnings: ["unknown WorkBuddy version"] };
  }
  const regions = await session.evaluate(selectorProbeExpression(adapter));
  const diagnosis = diagnoseRegionHits(regions, adapter);
  if (!diagnosis.compatible && !force) throw new Error(`adapter ${adapter.id} core selectors did not match; use --force to continue`);
  const current = semver.coerce(info.version)?.version;
  if (current && manifest.workbuddy?.minVersion && semver.lt(current, semver.coerce(manifest.workbuddy.minVersion)?.version || manifest.workbuddy.minVersion) && !force) throw new Error(`theme requires WorkBuddy ${manifest.workbuddy.minVersion} or newer`);
  if (current && manifest.workbuddy?.maxVersion && semver.gt(current, semver.coerce(manifest.workbuddy.maxVersion)?.version || manifest.workbuddy.maxVersion) && !force) throw new Error(`theme supports WorkBuddy up to ${manifest.workbuddy.maxVersion}`);
  return { info, adapter, diagnosis, warnings: diagnosis.missing.length ? [`missing regions: ${diagnosis.missing.join(", ")}`] : [] };
}

export async function inject(session, theme, { force = false } = {}) {
  const manifest = theme.manifest || theme;
  const checked = await preflight(session, manifest, { force });
  const compiled = await compileTheme(theme, checked.adapter);
  const expression = `(() => { const html=document.documentElement,body=document.body; if(!globalThis[${JSON.stringify(SNAPSHOT_KEY)}]) globalThis[${JSON.stringify(SNAPSHOT_KEY)}]={htmlClass:html.className,bodyClass:body?.className||"",htmlStyle:html.getAttribute("style"),bodyThemeName:body?.getAttribute("data-vscode-theme-name"),bodyThemeKind:body?.getAttribute("data-vscode-theme-kind")}; let el=document.getElementById(${JSON.stringify(STYLE_ID)}); if(!el){el=document.createElement("style");el.id=${JSON.stringify(STYLE_ID)};document.head.appendChild(el);} el.textContent=${JSON.stringify(compiled.css)};el.dataset.themeId=${JSON.stringify(manifest.id)};el.dataset.adapterId=${JSON.stringify(compiled.adapterId)};el.dataset.hash=${JSON.stringify(compiled.hash)};html.setAttribute("data-wb-theme-forge",${JSON.stringify(manifest.id)});${appearanceScript(manifest.appearance)}return{id:el.id,bytes:el.textContent.length,hash:el.dataset.hash,themeId:el.dataset.themeId,adapterId:el.dataset.adapterId}; })()`;
  const applied = await session.evaluate(expression);
  const verified = await inspectRenderer(session);
  if (verified.injection?.hash !== compiled.hash || verified.injection?.themeId !== manifest.id) throw new Error("theme injection verification failed");
  return { ...applied, version: checked.info.version, diagnosis: checked.diagnosis, warnings: checked.warnings };
}

export async function restore(session) {
  return session.evaluate(`(() => { const html=document.documentElement,body=document.body,snapshot=globalThis[${JSON.stringify(SNAPSHOT_KEY)}];document.getElementById(${JSON.stringify(STYLE_ID)})?.remove();html.removeAttribute("data-wb-theme-forge");if(snapshot){html.className=snapshot.htmlClass;if(body)body.className=snapshot.bodyClass;if(snapshot.htmlStyle===null)html.removeAttribute("style");else html.setAttribute("style",snapshot.htmlStyle);for(const [name,value] of [["data-vscode-theme-name",snapshot.bodyThemeName],["data-vscode-theme-kind",snapshot.bodyThemeKind]]){if(!body)continue;if(value===null)body.removeAttribute(name);else body.setAttribute(name,value);}delete globalThis[${JSON.stringify(SNAPSHOT_KEY)}];}return{restored:true};})()`);
}

export async function rollback(session, state) {
  await restore(session);
  if (!state?.hadStyle) return { rolledBack: true, native: true };
  return session.evaluate(`(() => { const html=document.documentElement,body=document.body;let el=document.createElement("style");el.id=${JSON.stringify(STYLE_ID)};el.textContent=${JSON.stringify(state.css || "")};Object.assign(el.dataset,${JSON.stringify(state.styleData || {})});document.head.appendChild(el);if(state.themeAttr===null)html.removeAttribute("data-wb-theme-forge");else html.setAttribute("data-wb-theme-forge",${JSON.stringify(state.themeAttr)});html.className=${JSON.stringify(state.appearance?.htmlClass || "")};if(body)body.className=${JSON.stringify(state.appearance?.bodyClass || "")};if(${JSON.stringify(state.appearance?.htmlStyle ?? null)}===null)html.removeAttribute("style");else html.setAttribute("style",${JSON.stringify(state.appearance?.htmlStyle ?? "")});for(const [name,value] of [["data-vscode-theme-name",${JSON.stringify(state.appearance?.bodyThemeName ?? null)}],["data-vscode-theme-kind",${JSON.stringify(state.appearance?.bodyThemeKind ?? null)}]]){if(!body)continue;if(value===null)body.removeAttribute(name);else body.setAttribute(name,value);}globalThis[${JSON.stringify(SNAPSHOT_KEY)}]=${JSON.stringify(state.baseAppearance || state.appearance || null)};return{rolledBack:true,themeId:el.dataset.themeId||null};})()`);
}
