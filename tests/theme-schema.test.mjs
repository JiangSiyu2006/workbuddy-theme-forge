import test from "node:test";
import assert from "node:assert/strict";
import { checkContrast, defaultTheme, validateThemeManifest } from "../src/theme-schema.mjs";
test("validates and normalizes a theme", () => { const theme = defaultTheme({ id: "test-theme", name: "Test" }); assert.equal(theme.colors.primary, "#6D78D6"); assert.equal(theme.appearance, "auto"); assert.equal(checkContrast(theme).passesAA, true); });
test("rejects unsafe ids and paths", () => { assert.throws(() => validateThemeManifest({ schemaVersion:1, id:"../x", name:"bad" })); assert.throws(() => validateThemeManifest({ schemaVersion:1, id:"safe", name:"bad", assets:{background:"../x.png"} })); });
test("validates v0.2 background and appearance fields", () => { const theme = defaultTheme({ appearance: "dark", background: { zoom: 1.5, positionX: 70, overlayOpacity: .3 } }); assert.equal(theme.appearance, "dark"); assert.equal(theme.background.zoom, 1.5); assert.throws(() => defaultTheme({ background: { zoom: 5 } })); });
