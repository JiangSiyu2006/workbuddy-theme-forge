import semver from "semver";

export const adapters = [
  {
    id: "adapter-535",
    range: ">=5.3.0 <5.4.0",
    signatureFallback: true,
    regions: {
      root: ["#root", ".teams-container"],
      sidebar: ["[data-view-id='sidebar']", ".conversation-sidebar"],
      main: ["[data-view-id='main-content']", ".teams-main-content"],
      chat: [".chat-container"],
      topbar: [".sidebar-next-main-header", "header"],
      input: ["[contenteditable='true']", "[role='textbox']"],
      panel: ["[data-view-id$='-panel']", "[role='dialog']"]
    },
    requiredRegions: ["root", "sidebar", "main"],
    optionalRegions: ["chat", "topbar", "input", "panel"],
    signatureVariables: ["--cb-bg-primary", "--cb-text-primary"],
    variables: ["--cb-bg-primary", "--cb-bg-secondary", "--cb-panel-bg-primary", "--cb-text-primary", "--cb-text-secondary", "--cb-text-link", "--cb-text-error-active", "--cb-vscode-editor-background", "--cb-vscode-sideBar-background", "--cb-vscode-input-background", "--cb-vscode-button-background", "--cb-stroke-secondary"],
    styleTargets: {
      root: ["#root"], topbar: [".sidebar-next-main-header", "header"], sidebar: ["[data-view-id='sidebar']", ".conversation-sidebar"],
      chat: ["[data-view-id='main-content']", ".teams-main-content", ".chat-container"], input: ["[contenteditable='true']", "[role='textbox']"],
      code: ["pre", "code"], panel: ["[data-view-id$='-panel']", "[role='dialog']"],
      transparent: [".teams-container", "[data-view-id]", ".conversation-list", ".main-content", ".main-content--welcome", ".sidebar-next"],
      viewportBounded: [".teams-container>div", ".teams-container>div>div", ".teams-container>div>div>div"]
    }
  },
  {
    id: "adapter-423",
    range: ">=4.23.0 <4.24.0",
    regions: {
      root: ["#root"], sidebar: ["[data-view-id='sidebar']"], main: ["[data-view-id='conversation']"],
      chat: ["[data-view-id='conversation']"], topbar: ["[data-view-id='titlebar']"], input: ["[contenteditable='true']"], panel: ["[data-view-id='panel']", "[role='dialog']"]
    },
    requiredRegions: ["root", "sidebar", "main"], optionalRegions: ["chat", "topbar", "input", "panel"],
    signatureVariables: ["--cb-bg-primary", "--cb-text-primary"],
    variables: ["--cb-bg-primary", "--cb-text-primary"]
  },
  {
    id: "adapter-422",
    range: ">=4.22.0 <4.23.0",
    regions: {
      root: ["#root"], sidebar: ["aside"], main: ["main"], chat: ["main"], topbar: ["header"], input: ["textarea", "[contenteditable='true']"], panel: ["[role='dialog']"]
    },
    requiredRegions: ["root", "sidebar", "main"], optionalRegions: ["chat", "topbar", "input", "panel"],
    signatureVariables: ["--cb-bg-primary", "--cb-text-primary"],
    variables: ["--cb-bg-primary", "--cb-text-primary"]
  }
];

export function selectAdapter(version = "") {
  const clean = semver.coerce(version)?.version;
  return clean ? adapters.find((adapter) => semver.satisfies(clean, adapter.range)) || null : null;
}

export function selectorProbeExpression(adapter) {
  return `(() => { const regions=${JSON.stringify(adapter.regions)}; return Object.fromEntries(Object.entries(regions).map(([name,selectors]) => [name,{selectors:Object.fromEntries(selectors.map(selector => [selector,document.querySelectorAll(selector).length])),hit:selectors.some(selector => document.querySelector(selector))}])); })()`;
}

export function diagnoseRegionHits(regions, adapter) {
  const names = Object.keys(adapter.regions);
  const missing = names.filter((name) => !regions?.[name]?.hit);
  const requiredMissing = adapter.requiredRegions.filter((name) => !regions?.[name]?.hit);
  return {
    adapter: adapter.id,
    regions: regions || {},
    missing,
    requiredMissing,
    coreMissing: requiredMissing,
    hitRate: names.length ? Number(((names.length - missing.length) / names.length).toFixed(2)) : 0,
    compatible: requiredMissing.length === 0
  };
}

export function signatureMatches(info, diagnosis, adapter) {
  const identity = /workbuddy/i.test(info.identity?.applicationName || "");
  const variables = adapter.signatureVariables.every((name) => Boolean(info.variables?.[name]));
  return identity && diagnosis.compatible && variables;
}

export const diagnoseSelectorHits = diagnoseRegionHits;
