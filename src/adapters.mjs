import semver from "semver";

export const adapters = [
  {
    id: "adapter-535",
    range: ">=5.3.0 <5.4.0",
    regions: {
      root: ["#root", ".teams-container"],
      sidebar: ["[data-view-id='sidebar']", ".conversation-sidebar"],
      main: ["[data-view-id='main-content']", ".teams-main-content"],
      chat: [".chat-container"],
      topbar: [".sidebar-next-main-header", "header"],
      input: ["[contenteditable='true']", "[role='textbox']"],
      panel: ["[data-view-id$='-panel']", "[role='dialog']"]
    },
    coreRegions: ["root", "sidebar", "main", "input"],
    variables: ["--cb-bg-primary", "--cb-bg-surface", "--cb-text-primary", "--cb-accent", "--cb-border"]
  },
  {
    id: "adapter-423",
    range: ">=4.23.0 <4.24.0",
    regions: {
      root: ["#root"], sidebar: ["[data-view-id='sidebar']"], main: ["[data-view-id='conversation']"],
      chat: ["[data-view-id='conversation']"], topbar: ["[data-view-id='titlebar']"], input: ["[contenteditable='true']"], panel: ["[data-view-id='panel']", "[role='dialog']"]
    },
    coreRegions: ["root", "sidebar", "main", "input"],
    variables: ["--cb-bg-primary", "--cb-text-primary"]
  },
  {
    id: "adapter-422",
    range: ">=4.22.0 <4.23.0",
    regions: {
      root: ["#root"], sidebar: ["aside"], main: ["main"], chat: ["main"], topbar: ["header"], input: ["textarea", "[contenteditable='true']"], panel: ["[role='dialog']"]
    },
    coreRegions: ["root", "sidebar", "main", "input"],
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
  const coreMissing = adapter.coreRegions.filter((name) => !regions?.[name]?.hit);
  return {
    adapter: adapter.id,
    regions: regions || {},
    missing,
    coreMissing,
    hitRate: names.length ? Number(((names.length - missing.length) / names.length).toFixed(2)) : 0,
    compatible: coreMissing.length < adapter.coreRegions.length
  };
}

export const diagnoseSelectorHits = diagnoseRegionHits;
