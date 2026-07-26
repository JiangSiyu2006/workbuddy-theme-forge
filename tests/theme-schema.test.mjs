import test from "node:test";
import assert from "node:assert/strict";
import { checkContrast, defaultTheme, validateThemeManifest } from "../src/theme-schema.mjs";
test("validates and normalizes a theme", () => { const theme = defaultTheme({ id: "test-theme", name: "Test" }); assert.equal(theme.colors.primary, "#7C5CFF"); assert.equal(checkContrast(theme).passesAA, true); });
test("rejects unsafe ids and paths", () => { assert.throws(() => validateThemeManifest({ schemaVersion:1, id:"../x", name:"bad" })); assert.throws(() => validateThemeManifest({ schemaVersion:1, id:"safe", name:"bad", assets:{background:"../x.png"} })); });
