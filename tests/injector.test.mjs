import test from "node:test";
import assert from "node:assert/strict";
import { inject } from "../src/injector.mjs";
import { defaultTheme } from "../src/theme-schema.mjs";

test("inject preflights WorkBuddy 5.3 and verifies an idempotent style", async () => {
  let injectionExpression = ""; let injection;
  const session = { evaluate: async (expression) => {
    if (expression.includes("const regions=")) return Object.fromEntries(["root", "sidebar", "main", "chat", "topbar", "input", "panel"].map((name) => [name, { hit: true, selectors: {} }]));
    if (expression.includes("let el=document.getElementById")) {
      injectionExpression = expression;
      const hash = expression.match(/el\.dataset\.hash=("[a-f0-9]+")/)?.[1];
      injection = { themeId: "aurora-night", hash: JSON.parse(hash), adapterId: "adapter-535", bytes: 100 };
      return injection;
    }
    return { version: "5.3.5", injection, appearance: {}, variables: {}, styles: 1 };
  } };
  const result = await inject(session, { manifest: defaultTheme({ workbuddy: { minVersion: "5.3.0", maxVersion: null } }), css: "" });
  assert.equal(result.adapterId, "adapter-535");
  assert.match(injectionExpression, /wb-theme-forge-style/);
  assert.equal((injectionExpression.match(/createElement/g) || []).length, 1);
});

test("auto appearance restores the original renderer appearance before applying", async () => {
  let expression = ""; let injection;
  const session = { evaluate: async (value) => {
    if (value.includes("const regions=")) return Object.fromEntries(["root", "sidebar", "main", "chat", "topbar", "input", "panel"].map((name) => [name, { hit: true }]));
    if (value.includes("let el=document.getElementById")) { expression = value; const hash = JSON.parse(value.match(/el\.dataset\.hash=("[a-f0-9]+")/)[1]); injection = { themeId: "aurora-night", hash }; return injection; }
    return { version: "5.3.5", injection, appearance: {}, variables: {}, identity: { applicationName: "WorkBuddy" } };
  } };
  await inject(session, { manifest: defaultTheme({ appearance: "auto" }), css: "" });
  assert.match(expression, /html\.className=base\.htmlClass/);
  assert.doesNotMatch(expression, /classList\.add\(\.\.\.\["dark"/);
});
