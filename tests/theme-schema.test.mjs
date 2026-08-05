import test from "node:test";
import assert from "node:assert/strict";
import { checkContrast, defaultTheme, themeToCss, validateThemeManifest } from "../src/theme-schema.mjs";
import { selectAdapter } from "../src/adapters.mjs";
import { EDITOR_COLOR_KEYS, themeTokens } from "../src/theme-contract.mjs";
test("validates and normalizes a theme", () => { const theme = defaultTheme({ id: "test-theme", name: "Test" }); assert.equal(theme.colors.primary, "#6D78D6"); assert.equal(theme.appearance, "auto"); assert.equal(checkContrast(theme).passesAA, true); });
test("rejects unsafe ids and paths", () => { assert.throws(() => validateThemeManifest({ schemaVersion:1, id:"../x", name:"bad" })); assert.throws(() => validateThemeManifest({ schemaVersion:1, id:"safe", name:"bad", assets:{background:"../x.png"} })); });
test("validates v0.2 background and appearance fields", () => { const theme = defaultTheme({ appearance: "dark", background: { zoom: 1.5, positionX: 70, overlayOpacity: .3 } }); assert.equal(theme.appearance, "dark"); assert.equal(theme.background.zoom, 1.5); assert.throws(() => defaultTheme({ background: { zoom: 5 } })); });
test("validates selectors with a CSS parser", () => { assert.throws(() => defaultTheme({ selectors: { chat: "div[" } }), /valid CSS/); });
test("every public editor field reaches preview tokens and injected CSS", () => {
  const theme = defaultTheme({ variables: { radius: 18, blur: 21, shadow: "0 1px 2px rgba(0,0,0,.2)", fontFamily: "Test Sans", fontSize: 17, lineHeight: 1.7, animation: true, animationSpeed: 2 }, background: { zoom: 1.4, positionX: 23, positionY: 67, opacity: .6, blur: 9, overlayColor: "#123456", overlayOpacity: .4, vignette: .3 } });
  const tokens = themeTokens(theme, "data:image/png;base64,AA==");
  const css = themeToCss(theme, "data:image/png;base64,AA==", selectAdapter("5.3.5"));
  for (const key of EDITOR_COLOR_KEYS) assert.match(css, new RegExp(theme.colors[key].replace("#", "#"), "i"));
  for (const value of Object.values(tokens)) if (value !== "none") assert.ok(css.includes(value) || css.includes(`var(--wb-`));
  assert.match(css, /backdrop-filter:blur\(var\(--wb-blur\)\)/);
  assert.doesNotMatch(css, /min-height:100vh/);
});

test("theme CSS preserves WorkBuddy's native root height below the title bar", () => {
  const css = themeToCss(defaultTheme(), "", selectAdapter("5.3.5"));
  assert.match(css, /html\[data-wb-theme-forge\] #root\{position:relative;isolation:isolate;background:/);
  assert.doesNotMatch(css, /#root\{[^}]*height:100vh/);
  assert.doesNotMatch(css, /#root\{[^}]*min-height:/);
  assert.match(css, /\.teams-container>div[^}]+\{max-height:100%!important;\}/);
});
