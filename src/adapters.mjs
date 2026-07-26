export const adapters = [
  { id: "adapter-422", min: "4.22.0", max: "4.22.x", selectors: ["header", "aside", "main"], variables: ["--cb-bg-primary", "--cb-text-primary"] },
  { id: "adapter-423", min: "4.23.0", max: "4.23.x", selectors: ["[data-view-id='titlebar']", "[data-view-id='sidebar']", "[data-view-id='conversation']"], variables: ["--cb-bg-primary", "--cb-text-primary"] }
];
export function selectAdapter(version = "") { return adapters.find((adapter) => version.startsWith(adapter.id.slice(-3))) || adapters[0]; }
export function diagnoseSelectorHits(hits, adapter = adapters[0]) { return { adapter: adapter.id, hits, missing: adapter.selectors.filter((selector) => !hits?.[selector]), hitRate: adapter.selectors.length ? Number((Object.values(hits || {}).filter(Boolean).length / adapter.selectors.length).toFixed(2)) : 0 }; }
