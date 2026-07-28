import test from "node:test";
import assert from "node:assert/strict";
import { scopeCustomCss, validateCustomCss, validateImageBytes } from "../src/theme-assets.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1cAAAAASUVORK5CYII=", "base64");

test("accepts a bounded PNG and reports its dimensions", () => {
  assert.deepEqual(validateImageBytes(png, ".png").dimensions, { width: 1, height: 1, type: "png" });
  assert.throws(() => validateImageBytes(png, ".txt"), /unsupported image extension/);
});

test("rejects remote and undeclared CSS resources", () => {
  assert.throws(() => validateCustomCss(".x{background:url(https://example.com/a.png)}"), /not a declared asset/);
  assert.throws(() => validateCustomCss("@import 'x.css';"), /not allowed/);
  assert.doesNotThrow(() => validateCustomCss(".x{background:url(assets/a.png)}", { assets: { background: "assets/a.png" } }));
});

test("scopes custom CSS to the active theme", () => {
  assert.match(scopeCustomCss(".x,.y{color:red}", "safe-theme"), /html\[data-wb-theme-forge="safe-theme"\]/);
  assert.doesNotMatch(scopeCustomCss(":root{color:red}", "safe-theme"), /\] :root/);
});
