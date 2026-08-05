import { EDITOR_COLOR_KEYS, themeTokens } from "/assets/theme-contract.mjs";

const { token } = globalThis.__WB_THEME_CONFIG__;
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const state = { themes: [], selected: null, history: [], future: [], dirty: false, baseline: "", lastRecorded: "", recordTimer: null, assetUrl: "", assetThemeId: "" };

$("colors").innerHTML = EDITOR_COLOR_KEYS.map((key) => `<div><label for="c_${key}">${key}</label><input id="c_${key}" type="color"></div>`).join("");

async function api(path, options = {}) {
  const request = { ...options, headers: { ...(options.headers || {}), "x-wb-theme-token": token } };
  if (request.body && typeof request.body !== "string") {
    request.headers["content-type"] = "application/json";
    request.body = JSON.stringify(request.body);
  }
  const response = await fetch(path, request);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    const error = new Error(payload.error || response.statusText);
    error.details = payload.details;
    throw error;
  }
  return response.headers.get("content-type")?.includes("json") ? response.json() : response.blob();
}

function note(message, isError = false) {
  $("toast").textContent = message;
  $("toast").className = isError ? "toast error" : "toast";
}

function numberValue(id) { return Number($(id).value); }

function readForm() {
  const base = state.selected?.manifest || {};
  let selectors;
  try { selectors = JSON.parse($("selectors").value); }
  catch { throw new Error("选择器 JSON 格式无效"); }
  if (!selectors || Array.isArray(selectors) || typeof selectors !== "object") throw new Error("选择器必须是 JSON 对象");
  for (const [name, selector] of Object.entries(selectors)) {
    if (typeof selector !== "string" || !selector.trim()) throw new Error(`选择器 ${name} 不是有效 CSS`);
    try { document.createDocumentFragment().querySelector(selector); } catch { throw new Error(`选择器 ${name} 不是有效 CSS`); }
  }
  const invalid = document.querySelector(".editor-card input:invalid,.editor-card select:invalid,.editor-card textarea:invalid");
  if (invalid) throw new Error(`${invalid.labels?.[0]?.textContent || invalid.id} 的值超出允许范围`);
  if (!$("name").value.trim()) throw new Error("主题名称不能为空");
  return {
    ...base,
    schemaVersion: 1,
    id: $("id").value,
    name: $("name").value,
    appearance: $("appearance").value,
    colors: { ...(base.colors || {}), ...Object.fromEntries(EDITOR_COLOR_KEYS.map((key) => [key, $(`c_${key}`).value])) },
    variables: {
      ...(base.variables || {}), radius: numberValue("radius"), blur: numberValue("blur"), shadow: $("shadow").value,
      fontFamily: $("fontFamily").value, fontSize: numberValue("fontSize"), lineHeight: numberValue("lineHeight"),
      animation: $("animation").checked, animationSpeed: numberValue("animationSpeed")
    },
    selectors,
    background: {
      ...(base.background || {}), fit: $("fit").value, zoom: numberValue("zoom"), positionX: numberValue("positionX"),
      positionY: numberValue("positionY"), opacity: numberValue("opacity"), blur: numberValue("backgroundBlur"),
      overlayColor: $("overlayColor").value, overlayOpacity: numberValue("overlayOpacity"), vignette: numberValue("vignette")
    },
    reducedMotion: { enabled: $("reducedMotion").checked }
  };
}

function formSnapshot() { return JSON.stringify({ manifest: readForm(), css: $("customCss").value }); }

function setDirty(value) {
  state.dirty = value;
  $("dirtyBadge").classList.toggle("visible", value);
}

function validateAndRender() {
  try {
    const manifest = readForm();
    $("formError").textContent = "";
    $("save").disabled = false;
    $("apply").disabled = false;
    renderPreview(manifest);
    return manifest;
  } catch (error) {
    $("formError").textContent = error.message;
    $("save").disabled = true;
    $("apply").disabled = true;
    return null;
  }
}

function recordChange() {
  if (!state.selected) return;
  validateAndRender();
  setDirty(true);
  clearTimeout(state.recordTimer);
  state.recordTimer = setTimeout(() => {
    let current;
    try { current = formSnapshot(); } catch { return; }
    const previous = state.lastRecorded || state.baseline;
    if (previous !== current) {
      state.history.push(previous);
      if (state.history.length > 50) state.history.shift();
      state.future = [];
      state.lastRecorded = current;
    }
  }, 250);
}

function writeForm(theme, { resetHistory = true, updateBaseline = true } = {}) {
  state.selected = theme;
  const manifest = theme.manifest;
  $("id").value = manifest.id;
  $("name").value = manifest.name;
  $("appearance").value = manifest.appearance;
  EDITOR_COLOR_KEYS.forEach((key) => { $(`c_${key}`).value = manifest.colors[key]; });
  for (const key of ["radius", "blur", "shadow", "fontFamily", "fontSize", "lineHeight", "animationSpeed"]) $(key).value = manifest.variables[key];
  $("animation").checked = manifest.variables.animation;
  $("reducedMotion").checked = manifest.reducedMotion.enabled;
  for (const key of ["fit", "zoom", "positionX", "positionY", "opacity", "vignette"]) $(key).value = manifest.background[key];
  $("backgroundBlur").value = manifest.background.blur;
  $("overlayColor").value = manifest.background.overlayColor;
  $("overlayOpacity").value = manifest.background.overlayOpacity;
  $("selectors").value = JSON.stringify(manifest.selectors, null, 2);
  $("customCss").value = theme.css || "";
  if (resetHistory) { state.history = []; state.future = []; }
  if (updateBaseline) {
    state.baseline = formSnapshot();
    state.lastRecorded = state.baseline;
  }
  setDirty(false);
  validateAndRender();
  loadPreviewAsset(theme).catch((error) => note(error.message, true));
}

async function loadPreviewAsset(theme) {
  if (state.assetUrl) URL.revokeObjectURL(state.assetUrl);
  state.assetUrl = "";
  state.assetThemeId = theme.manifest.id;
  if (!theme.hasBackground) return renderPreview(readForm());
  const blob = await api(`/api/themes/${theme.manifest.id}/background`);
  if (state.selected?.manifest.id !== theme.manifest.id || state.assetThemeId !== theme.manifest.id) return;
  state.assetUrl = URL.createObjectURL(blob);
  renderPreview(readForm());
}

function renderPreview(manifest) {
  const preview = $("preview");
  for (const [name, value] of Object.entries(themeTokens(manifest, state.assetUrl))) preview.style.setProperty(name, value);
  const background = manifest.background;
  const vignetteStop = Math.round((1 - background.vignette) * 70);
  preview.querySelector(".wb-overlay").style.background = `radial-gradient(circle at center,transparent ${vignetteStop}%,rgba(0,0,0,${background.vignette})),linear-gradient(${background.overlayColor}${alpha(background.overlayOpacity)},${background.overlayColor}${alpha(background.overlayOpacity)})`;
  preview.classList.toggle("reduced-motion", manifest.reducedMotion.enabled || !manifest.variables.animation);
  $("previewThemeName").textContent = manifest.name;
  const ratio = contrast(manifest.colors.text, manifest.colors.background);
  $("contrast").textContent = `文字/背景对比度 ${ratio.toFixed(2)} · ${ratio >= 4.5 ? "WCAG AA 通过" : "WCAG AA 风险"}`;
}

function alpha(value) { return Math.round(value * 255).toString(16).padStart(2, "0"); }
function contrast(first, second) {
  const luminance = (hex) => { const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
  return (Math.max(luminance(first), luminance(second)) + .05) / (Math.min(luminance(first), luminance(second)) + .05);
}

function renderThemes() {
  $("themes").innerHTML = state.themes.map((theme, index) => `<button class="theme ${state.selected?.manifest.id === theme.manifest.id ? "active" : ""}" data-index="${index}"><span>${escapeHtml(theme.manifest.name)}</span><small>${theme.builtIn ? "内置" : "本地"}</small></button>`).join("");
  document.querySelectorAll(".theme").forEach((button) => button.addEventListener("click", () => {
    if (state.dirty && !confirm("放弃未保存的更改？")) return;
    writeForm(state.themes[Number(button.dataset.index)]);
    renderThemes();
  }));
  $("remove").disabled = !state.selected || state.selected.builtIn;
}

async function refresh({ selectId = null, forceForm = false } = {}) {
  const dashboard = await api("/api/dashboard");
  state.themes = dashboard.themes;
  const wanted = selectId || state.selected?.manifest.id;
  const keep = state.themes.find((theme) => theme.manifest.id === wanted) || state.themes[0];
  if (keep && (!state.dirty || forceForm || !state.selected)) writeForm(keep, { resetHistory: true });
  renderThemes();
  renderDashboard(dashboard);
}

function renderDashboard(dashboard) {
  const cdp = dashboard.doctor.cdp;
  const renderer = cdp.renderers?.[0];
  $("status").innerHTML = `<span class="pill ${cdp.ok ? "ok" : "bad"}">CDP ${cdp.ok ? `已连接 :${dashboard.doctor.port}` : cdp.endpointReachable ? "无有效 WorkBuddy renderer" : "不可用"}</span><span class="pill">${escapeHtml(renderer?.renderer.version || "unknown")}</span><span class="pill">${escapeHtml(dashboard.state.status)}</span>`;
  $("diagnostics").textContent = renderer ? `端口来源 ${dashboard.doctor.portSource} · 进程归属 ${dashboard.doctor.ownerVerified ? "已验证" : "未验证"} · 适配器 ${renderer.adapter || "unknown"} · ${renderer.adapterMatchReason || "未匹配"} · 命中率 ${Math.round((renderer.compatibility?.hitRate || 0) * 100)}% · 缺失 ${renderer.compatibility?.missing.join(", ") || "无"}` : cdp.message;
  const health = dashboard.daemon;
  $("daemonHealth").textContent = `连续失败 ${health.consecutiveFailures} · 最近成功 ${health.lastSuccessAt || "尚无"}${health.lastError ? ` · ${health.lastError}` : ""}`;
  $("logs").textContent = dashboard.logs.map((entry) => `${entry.time} ${entry.level} ${entry.event}${entry.error ? ` · ${entry.error}` : ""}`).join("\n");
}

async function action(name, body = {}) {
  try {
    note("处理中...");
    const payload = await api(`/api/actions/${name}`, { method: "POST", body });
    note("操作完成");
    await refresh({ selectId: payload.themeId || state.selected?.manifest.id, forceForm: Boolean(payload.themeId) });
  } catch (error) { note(error.details ? `${error.message}: ${JSON.stringify(error.details)}` : error.message, true); }
}

async function saveCurrent() {
  const manifest = validateAndRender();
  if (!manifest) return;
  try {
    const payload = await api("/api/themes", { method: "POST", body: { sourceThemeId: state.selected.manifest.id, manifest, css: $("customCss").value } });
    note(payload.copiedFromBuiltIn ? "内置主题已保存为本地副本" : "已保存");
    await refresh({ selectId: payload.theme.manifest.id, forceForm: true });
  } catch (error) { note(error.message, true); }
}

async function applyCurrent() {
  const manifest = validateAndRender();
  if (!manifest) return;
  const draft = state.dirty ? { sourceThemeId: state.selected.manifest.id, manifest, css: $("customCss").value } : undefined;
  await action("apply", { themeId: state.selected.manifest.id, draft });
}

function restoreSnapshot(serialized) {
  const snapshot = JSON.parse(serialized);
  writeForm({ ...state.selected, manifest: snapshot.manifest, css: snapshot.css }, { resetHistory: false, updateBaseline: false });
  state.lastRecorded = serialized;
  setDirty(serialized !== state.baseline);
}

function fileBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }

document.querySelectorAll("input:not([type=file]),select,textarea").forEach((element) => element.addEventListener("input", recordChange));
$("apply").addEventListener("click", applyCurrent);
$("pause").addEventListener("click", () => action("pause"));
$("resume").addEventListener("click", () => action("resume"));
$("native").addEventListener("click", () => action("restore"));
$("rollback").addEventListener("click", () => action("rollback"));
$("save").addEventListener("click", saveCurrent);
$("duplicate").addEventListener("click", async () => { const name = prompt("副本名称", `${state.selected.manifest.name} Copy`); if (!name) return; try { const payload = await api(`/api/themes/${state.selected.manifest.id}/duplicate`, { method: "POST", body: { name } }); await refresh({ selectId: payload.theme.manifest.id, forceForm: true }); } catch (error) { note(error.message, true); } });
$("remove").addEventListener("click", async () => { if (!confirm("删除这个本地主题？")) return; try { await api(`/api/themes/${state.selected.manifest.id}`, { method: "DELETE" }); state.selected = null; setDirty(false); await refresh({ forceForm: true }); } catch (error) { note(error.message, true); } });
$("export").addEventListener("click", async () => { try { const blob = await api(`/api/themes/${state.selected.manifest.id}/export`); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${state.selected.manifest.id}.wbtheme`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); } catch (error) { note(error.message, true); } });
$("import").addEventListener("change", async () => { const file = $("import").files[0]; if (!file) return; try { const payload = await api("/api/import", { method: "POST", body: { name: file.name, data: await fileBase64(file), conflict: "copy" } }); await refresh({ selectId: payload.theme.manifest.id, forceForm: true }); } catch (error) { note(error.message, true); } });
$("createImage").addEventListener("click", async () => { const file = $("image").files[0]; if (!file) return note("请选择图片", true); try { const payload = await api("/api/create-image", { method: "POST", body: { name: $("imageName").value || file.name.replace(/\.[^.]+$/, ""), filename: file.name, data: await fileBase64(file) } }); await refresh({ selectId: payload.theme.manifest.id, forceForm: true }); } catch (error) { note(error.message, true); } });
$("undo").addEventListener("click", () => { clearTimeout(state.recordTimer); let current = null; try { current = formSnapshot(); } catch {} if (!state.history.length && current === state.baseline) return; if (current) state.future.push(current); restoreSnapshot(state.history.pop() || state.baseline); });
$("redo").addEventListener("click", () => { if (!state.future.length) return; const current = formSnapshot(); state.history.push(current); restoreSnapshot(state.future.pop()); });
window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });

refresh().catch((error) => note(error.message, true));
setInterval(() => refresh().catch((error) => note(error.message, true)), 5000);
