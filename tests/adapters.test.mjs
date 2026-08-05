import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseRegionHits, selectAdapter, selectorProbeExpression, signatureMatches } from "../src/adapters.mjs";

test("selects the WorkBuddy 5.3 adapter", () => {
  assert.equal(selectAdapter("5.3.5").id, "adapter-535");
  assert.equal(selectAdapter("5.4.0"), null);
});

test("generates a syntactically valid renderer probe", () => {
  const expression = selectorProbeExpression(selectAdapter("5.3.5"));
  assert.doesNotThrow(() => new Function("document", `return ${expression}`));
});

test("diagnoses logical regions and core compatibility", () => {
  const adapter = selectAdapter("5.3.5");
  const diagnosis = diagnoseRegionHits({ root: { hit: true }, sidebar: { hit: true }, main: { hit: false }, input: { hit: true } }, adapter);
  assert.equal(diagnosis.compatible, false);
  assert.ok(diagnosis.missing.includes("main"));
  assert.deepEqual(diagnosis.requiredMissing, ["main"]);
});

test("unknown versions require WorkBuddy identity, DOM signature, and variables", () => {
  const adapter = selectAdapter("5.3.5");
  const diagnosis = diagnoseRegionHits(Object.fromEntries(Object.keys(adapter.regions).map((name) => [name, { hit: true }])), adapter);
  assert.equal(signatureMatches({ identity: { applicationName: "WorkBuddy" }, variables: { "--cb-bg-primary": "#000", "--cb-text-primary": "#fff" } }, diagnosis, adapter), true);
  assert.equal(signatureMatches({ identity: { applicationName: "ChatGPT" }, variables: { "--cb-bg-primary": "#000", "--cb-text-primary": "#fff" } }, diagnosis, adapter), false);
});
