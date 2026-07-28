import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseRegionHits, selectAdapter, selectorProbeExpression } from "../src/adapters.mjs";

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
  assert.equal(diagnosis.compatible, true);
  assert.ok(diagnosis.missing.includes("main"));
});
